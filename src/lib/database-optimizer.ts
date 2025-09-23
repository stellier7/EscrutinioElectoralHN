// Optimizaciones de base de datos para alta concurrencia
// Versión simple para manejar 20,000 usuarios/hora

import { prisma } from './prisma';

export class DatabaseOptimizer {
  // Cache simple en memoria para datos que cambian poco
  private static cache = new Map<string, { data: any; expires: number }>();
  private static CACHE_TTL = {
    mesas: 60 * 60 * 1000,      // 1 hora
    candidates: 60 * 60 * 1000, // 1 hora
    users: 5 * 60 * 1000,       // 5 minutos
  };

  // Obtener mesa con cache
  static async getMesa(number: string) {
    const cacheKey = `mesa:${number}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    const mesa = await prisma.mesa.findUnique({
      where: { number },
      select: { id: true, number: true, location: true, department: true }
    });

    if (mesa) {
      this.cache.set(cacheKey, {
        data: mesa,
        expires: Date.now() + this.CACHE_TTL.mesas
      });
    }

    return mesa;
  }

  // Obtener candidatos con cache
  static async getCandidates(electionId: string) {
    const cacheKey = `candidates:${electionId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    const candidates = await prisma.candidate.findMany({
      where: { electionId, isActive: true },
      select: { id: true, name: true, party: true, number: true, electionLevel: true }
    });

    this.cache.set(cacheKey, {
      data: candidates,
      expires: Date.now() + this.CACHE_TTL.candidates
    });

    return candidates;
  }

  // Verificar usuario con cache
  static async getUserStatus(userId: string) {
    const cacheKey = `user:${userId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, isActive: true }
    });

    if (user) {
      this.cache.set(cacheKey, {
        data: user,
        expires: Date.now() + this.CACHE_TTL.users
      });
    }

    return user;
  }

  // Crear escrutinio optimizado
  static async createEscrutinio(data: {
    userId: string;
    electionId: string;
    mesaId: string;
    electionLevel: string;
    latitude: number;
    longitude: number;
    locationAccuracy?: number;
  }) {
    // Usar transacción para atomicidad
    return await prisma.$transaction(async (tx) => {
      // Verificar si ya existe
      const existing = await tx.escrutinio.findFirst({
        where: {
          userId: data.userId,
          electionId: data.electionId,
          mesaId: data.mesaId,
          electionLevel: data.electionLevel as any,
        },
      });

      if (existing) {
        // Actualizar existente
        return await tx.escrutinio.update({
          where: { id: existing.id },
          data: {
            latitude: data.latitude,
            longitude: data.longitude,
            locationAccuracy: data.locationAccuracy,
          },
        });
      } else {
        // Crear nuevo
        return await tx.escrutinio.create({
          data: {
            ...data,
            electionLevel: data.electionLevel as any,
            status: 'PENDING',
            isCompleted: false,
            priority: 0, // Se asignará basado en rol
          },
        });
      }
    });
  }

  // Limpiar cache (útil para testing)
  static clearCache() {
    this.cache.clear();
  }

  // Obtener estadísticas de cache
  static getCacheStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now < value.expires) {
        valid++;
      } else {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      hitRate: valid / (valid + expired) || 0
    };
  }
}
