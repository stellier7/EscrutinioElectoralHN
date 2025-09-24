import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { SimpleRateLimiter } from '@/lib/rate-limiter';

export const runtime = 'nodejs';

const BodySchema = z.object({
  mesaNumber: z.string().min(1),
  electionLevel: z.enum(['PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL']),
  gps: z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional() }),
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // Rate limiting por rol de usuario
    const rateLimitResult = SimpleRateLimiter.checkLimit(payload.userId, payload.role);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ 
        success: false, 
        error: 'Límite de requests excedido. Intenta de nuevo más tarde.',
        rateLimitInfo: {
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime
        }
      }, { status: 429 });
    }

    const json = await request.json();
    console.log('🔍 [START API] Request body recibido:', JSON.stringify(json, null, 2));
    
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      console.error('❌ [START API] Error de validación:', JSON.stringify(parsed.error, null, 2));
      console.error('❌ [START API] Datos que fallaron:', JSON.stringify(json, null, 2));
      return NextResponse.json({ 
        success: false, 
        error: 'Payload inválido',
        details: parsed.error.errors 
      }, { status: 400 });
    }
    const { mesaNumber, electionLevel, gps } = parsed.data;

    // Pick the first active election; adjust as needed
    let election = await prisma.election.findFirst({ where: { isActive: true }, orderBy: { startDate: 'desc' } });
    if (!election) {
      // Crear elección por defecto si no existe (para ambientes sin seed)
      election = await prisma.election.create({
        data: {
          name: 'Elección Activa',
          description: 'Generada automáticamente',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      });
    }

    // Ensure Mesa exists by number; create placeholder if not exists
    let mesa = await prisma.mesa.findUnique({ where: { number: mesaNumber } });
    if (!mesa) {
      mesa = await prisma.mesa.create({ 
        data: { 
          number: mesaNumber, 
          location: 'Sin definir',
          department: 'Departamento no especificado'
        } 
      });
    }

    // If already exists for this user/election/mesa/level, reuse it (update location)
    const existing = await prisma.escrutinio.findFirst({
      where: {
        userId: payload.userId,
        electionId: election.id,
        mesaId: mesa.id,
        electionLevel: electionLevel as any,
      },
    });

    let escrutinioId: string;
    if (existing) {
      const updated = await prisma.escrutinio.update({
        where: { id: existing.id },
        data: { latitude: gps.latitude, longitude: gps.longitude, locationAccuracy: gps.accuracy },
      });
      escrutinioId = updated.id;
    } else {
      const created = await prisma.escrutinio.create({
        data: {
          userId: payload.userId,
          electionId: election.id,
          mesaId: mesa.id,
          electionLevel: electionLevel as any,
          latitude: gps.latitude,
          longitude: gps.longitude,
          locationAccuracy: gps.accuracy,
          status: 'PENDING',
          isCompleted: false,
        },
      });
      escrutinioId = created.id;
    }

    return NextResponse.json({ success: true, data: { escrutinioId } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Error interno' }, { status: 500 });
  }
}

