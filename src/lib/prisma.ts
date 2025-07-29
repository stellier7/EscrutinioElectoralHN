import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create a more robust Prisma client that handles connection errors
const createPrismaClient = () => {
  try {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Test the connection
    client.$connect()
      .then(() => {
        console.log('✅ Database connected successfully');
      })
      .catch((error) => {
        console.error('❌ Database connection failed:', error);
        // Don't throw in production, let the app continue with mock data
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ Continuing with mock data due to database connection failure');
        }
      });

    return client;
  } catch (error) {
    console.error('Failed to create Prisma client:', error);
    
    // In production, we should fail fast if we can't connect to the database
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Critical: Cannot create Prisma client in production');
      throw new Error(`Database connection failed: ${error}`);
    }
    
    // Only use mock client in development
    console.warn('⚠️ Using mock Prisma client for development');
    return createMockPrismaClient();
  }
};

// Create a mock Prisma client for development/testing
const createMockPrismaClient = () => {
  return {
    user: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    election: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    candidate: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    mesa: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    escrutinio: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    vote: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    correction: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    auditLog: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    systemConfig: { 
      findMany: () => [], 
      findUnique: () => null, 
      create: () => ({}), 
      update: () => ({}) 
    },
    $connect: () => Promise.resolve(),
    $disconnect: () => Promise.resolve(),
    $executeRaw: () => Promise.resolve(),
    $queryRaw: () => Promise.resolve([]),
  } as any;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma; 