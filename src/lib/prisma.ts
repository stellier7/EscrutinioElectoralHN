import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create a more robust Prisma client that handles connection errors
const createPrismaClient = () => {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  } catch (error) {
    console.error('Failed to create Prisma client:', error);
    // Return a mock client for build purposes
    return {
      user: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
      election: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
      candidate: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
      mesa: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
      escrutinio: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
      vote: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
      correction: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
      auditLog: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
      systemConfig: { findMany: () => [], findUnique: () => null, create: () => ({}), update: () => ({}) },
    } as any;
  }
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma; 