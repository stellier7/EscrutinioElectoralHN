import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AuthUtils } from '@/lib/auth';
import type { ApiResponse } from '@/types';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

// Create Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🔄 Setting up database and seeding data...');
    
    // Create enum types first
    try {
      await prisma.$executeRaw`CREATE TYPE "UserRole" AS ENUM ('VOLUNTEER', 'ORGANIZATION_MEMBER', 'ADMIN', 'AUDITOR')`;
    } catch (e) {
      console.log('UserRole enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "ElectionLevel" AS ENUM ('PRESIDENTE', 'DIPUTADO', 'ALCALDE', 'CORREGIDOR')`;
    } catch (e) {
      console.log('ElectionLevel enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "AuditLogAction" AS ENUM ('LOGIN', 'LOGOUT', 'REGISTER', 'ESCRUTINIO_START', 'ESCRUTINIO_COMPLETE', 'VOTE_UPDATE', 'TRANSMISSION')`;
    } catch (e) {
      console.log('AuditLogAction enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "TransmissionStatus" AS ENUM ('PENDING', 'TRANSMITTED', 'FAILED')`;
    } catch (e) {
      console.log('TransmissionStatus enum already exists');
    }
    
    // Create tables
    try {
      await prisma.$executeRaw`
        CREATE TABLE "users" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "password" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "role" "UserRole" NOT NULL DEFAULT 'VOLUNTEER',
          "deviceId" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "users_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Users table already exists');
    }
    
    try {
      await prisma.$executeRaw`
        CREATE TABLE "elections" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "level" "ElectionLevel" NOT NULL,
          "date" TIMESTAMP(3) NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Elections table already exists');
    }
    
    try {
      await prisma.$executeRaw`
        CREATE TABLE "candidates" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "party" TEXT,
          "electionId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Candidates table already exists');
    }
    
    try {
      await prisma.$executeRaw`
        CREATE TABLE "escrutinios" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "electionId" TEXT NOT NULL,
          "mesa" TEXT NOT NULL,
          "latitude" DOUBLE PRECISION,
          "longitude" DOUBLE PRECISION,
          "accuracy" DOUBLE PRECISION,
          "status" "TransmissionStatus" NOT NULL DEFAULT 'PENDING',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "escrutinios_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Escrutinios table already exists');
    }
    
    try {
      await prisma.$executeRaw`
        CREATE TABLE "votes" (
          "id" TEXT NOT NULL,
          "escrutinioId" TEXT NOT NULL,
          "candidateId" TEXT NOT NULL,
          "count" INTEGER NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Votes table already exists');
    }
    
    try {
      await prisma.$executeRaw`
        CREATE TABLE "audit_logs" (
          "id" TEXT NOT NULL,
          "action" "AuditLogAction" NOT NULL,
          "description" TEXT NOT NULL,
          "userId" TEXT,
          "metadata" JSONB,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Audit logs table already exists');
    }
    
    // Seed data
    console.log('🌱 Seeding database...');
    
    // Create admin user
    const adminPassword = await AuthUtils.hashPassword('admin123');
    await prisma.user.upsert({
      where: { email: 'admin@escrutinio.com' },
      update: {},
      create: {
        id: 'admin-001',
        email: 'admin@escrutinio.com',
        password: adminPassword,
        name: 'Administrador del Sistema',
        role: 'ADMIN',
        deviceId: null,
        isActive: true,
      },
    });
    
    // Create auditor user
    const auditorPassword = await AuthUtils.hashPassword('auditor123');
    await prisma.user.upsert({
      where: { email: 'auditor@escrutinio.com' },
      update: {},
      create: {
        id: 'auditor-001',
        email: 'auditor@escrutinio.com',
        password: auditorPassword,
        name: 'Auditor del Sistema',
        role: 'ORGANIZATION_MEMBER',
        deviceId: null,
        isActive: true,
      },
    });
    
    // Create sample election
    await prisma.election.upsert({
      where: { id: 'election-2024' },
      update: {},
      create: {
        id: 'election-2024',
        name: 'Elecciones Generales 2024',
        description: 'Elecciones presidenciales y legislativas 2024',
        startDate: new Date('2024-11-24T06:00:00Z'),
        endDate: new Date('2024-11-24T18:00:00Z'),
        isActive: true,
      },
    });
    
    // Create sample candidates
    const candidates = [
      { id: 'candidate-1', name: 'Xiomara Castro', party: 'LIBRE', number: 1 },
      { id: 'candidate-2', name: 'Nasry Asfura', party: 'PNH', number: 2 },
      { id: 'candidate-3', name: 'Yani Rosenthal', party: 'PLH', number: 3 },
    ];
    
    for (const candidate of candidates) {
      await prisma.candidate.upsert({
        where: { id: candidate.id },
        update: {},
        create: {
          id: candidate.id,
          name: candidate.name,
          party: candidate.party,
          number: candidate.number,
          electionId: 'election-2024',
          electionLevel: 'PRESIDENTIAL',
          isActive: true,
        },
      });
    }
    
    console.log('✅ Database setup and seeding completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Database setup and seeding completed successfully',
    } as ApiResponse, { status: 200 });
    
  } catch (error) {
    console.error('❌ Setup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to setup database',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as ApiResponse, { status: 500 });
  }
} 