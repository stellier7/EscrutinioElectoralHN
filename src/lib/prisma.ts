import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with optimized configuration
const createPrismaClient = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Optimizaciones para alta concurrencia
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'query'] : ['error'],
    // Connection pool optimization
    // Note: Prisma handles connection pooling automatically with DATABASE_URL connection pooling
  });
};

// Reuse Prisma client globally to avoid creating multiple instances
// This is especially important in serverless environments like Vercel
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In both development and production, we should reuse the client
// This prevents connection pool exhaustion in serverless environments
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
} else {
  // In production (Vercel), also reuse to avoid multiple instances per serverless function
  globalForPrisma.prisma = prisma;
}

// Add event listeners for debugging slow queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    if (e.duration > 1000) {
      console.warn(`⚠️ Slow query detected (${e.duration}ms):`, e.query);
    }
  });
}

// Handle graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
} 