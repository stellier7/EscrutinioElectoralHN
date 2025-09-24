import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Optimizaciones para alta concurrencia
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Configuración de conexión para alta concurrencia
  __internal: {
    engine: {
      // Configuración de pool de conexiones
      connectionLimit: 20, // Máximo 20 conexiones simultáneas
      poolTimeout: 10, // Timeout de 10 segundos para obtener conexión
      connectTimeout: 10, // Timeout de 10 segundos para conectar
      // Configuración de retry
      retryAttempts: 3, // Reintentar 3 veces
      retryDelay: 1000, // Esperar 1 segundo entre reintentos
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 