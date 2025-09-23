import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AuthUtils } from '../../../lib/auth';
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
      await prisma.$executeRaw`CREATE TYPE "UserRole" AS ENUM ('OBSERVER', 'VOLUNTEER', 'ADMIN')`;
    } catch (e) {
      console.log('UserRole enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "ElectionLevel" AS ENUM ('PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL')`;
    } catch (e) {
      console.log('ElectionLevel enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "AuditLogAction" AS ENUM ('LOGIN', 'LOGOUT', 'START_ESCRUTINIO', 'SUBMIT_RESULTS', 'UPLOAD_EVIDENCE', 'CORRECTION', 'TRANSMISSION', 'VIEW_RESULTS', 'USER_APPROVED', 'USER_REJECTED', 'USER_SUSPENDED')`;
    } catch (e) {
      console.log('AuditLogAction enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "TransmissionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')`;
    } catch (e) {
      console.log('TransmissionStatus enum already exists');
    }
    
    // Create UserStatus enum
    try {
      await prisma.$executeRaw`CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')`;
    } catch (e) {
      console.log('UserStatus enum already exists');
    }

    // Create PapeletaStatus enum
    try {
      await prisma.$executeRaw`CREATE TYPE "PapeletaStatus" AS ENUM ('OPEN', 'CLOSED', 'ANULADA')`;
    } catch (e) {
      console.log('PapeletaStatus enum already exists');
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
          "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
          "deviceId" TEXT,
          "phone" TEXT,
          "organization" TEXT,
          "notes" TEXT,
          "approvedAt" TIMESTAMP(3),
          "approvedBy" TEXT,
          "rejectedAt" TIMESTAMP(3),
          "rejectedBy" TEXT,
          "rejectionReason" TEXT,
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
          "description" TEXT,
          "startDate" TIMESTAMP(3) NOT NULL,
          "endDate" TIMESTAMP(3) NOT NULL,
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
          "party" TEXT NOT NULL,
          "number" INTEGER NOT NULL,
          "electionId" TEXT NOT NULL,
          "electionLevel" "ElectionLevel" NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Candidates table already exists');
    }
    
    // Create Mesa table first
    try {
      await prisma.$executeRaw`
        CREATE TABLE "mesas" (
          "id" TEXT NOT NULL,
          "number" TEXT NOT NULL,
          "location" TEXT NOT NULL,
          "address" TEXT,
          "department" TEXT NOT NULL,
          "municipality" TEXT,
          "area" TEXT,
          "electoralLoad" INTEGER,
          "latitude" DOUBLE PRECISION,
          "longitude" DOUBLE PRECISION,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Mesas table already exists');
    }

    // Create Department table
    try {
      await prisma.$executeRaw`
        CREATE TABLE "departments" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "code" INTEGER,
          "diputados" INTEGER NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Departments table already exists');
    }

    try {
      await prisma.$executeRaw`
        CREATE TABLE "escrutinios" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "electionId" TEXT NOT NULL,
          "mesaId" TEXT NOT NULL,
          "electionLevel" "ElectionLevel" NOT NULL,
          "latitude" DOUBLE PRECISION NOT NULL,
          "longitude" DOUBLE PRECISION NOT NULL,
          "locationAccuracy" DOUBLE PRECISION,
          "status" "TransmissionStatus" NOT NULL DEFAULT 'PENDING',
          "isCompleted" BOOLEAN NOT NULL DEFAULT false,
          "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "completedAt" TIMESTAMP(3),
          "transmittedAt" TIMESTAMP(3),
          "actaImageUrl" TEXT,
          "actaImageHash" TEXT,
          "validationHash" TEXT,
          "encryptedData" TEXT,
          "priority" INTEGER NOT NULL DEFAULT 0,
          "queuePosition" INTEGER,
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
          "count" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Votes table already exists');
    }

    // Create Correction table
    try {
      await prisma.$executeRaw`
        CREATE TABLE "corrections" (
          "id" TEXT NOT NULL,
          "escrutinioId" TEXT NOT NULL,
          "candidateId" TEXT NOT NULL,
          "oldValue" INTEGER NOT NULL,
          "newValue" INTEGER NOT NULL,
          "reason" TEXT,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Corrections table already exists');
    }
    
    try {
      await prisma.$executeRaw`
        CREATE TABLE "audit_logs" (
          "id" TEXT NOT NULL,
          "userId" TEXT,
          "action" "AuditLogAction" NOT NULL,
          "description" TEXT NOT NULL,
          "metadata" JSONB,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Audit logs table already exists');
    }

    // Create Papeleta table
    try {
      await prisma.$executeRaw`
        CREATE TABLE "papeletas" (
          "id" TEXT NOT NULL,
          "escrutinioId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "status" "PapeletaStatus" NOT NULL DEFAULT 'OPEN',
          "votesBuffer" JSONB NOT NULL DEFAULT '[]',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "closedAt" TIMESTAMP(3),
          "anuladaAt" TIMESTAMP(3),
          "anuladaReason" TEXT,
          CONSTRAINT "papeletas_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('Papeletas table already exists');
    }

    // Create SystemConfig table
    try {
      await prisma.$executeRaw`
        CREATE TABLE "system_config" (
          "id" TEXT NOT NULL,
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "description" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('SystemConfig table already exists');
    }

    // Create OfflineQueue table
    try {
      await prisma.$executeRaw`
        CREATE TABLE "offline_queue" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "data" JSONB NOT NULL,
          "priority" INTEGER NOT NULL DEFAULT 0,
          "retryCount" INTEGER NOT NULL DEFAULT 0,
          "maxRetries" INTEGER NOT NULL DEFAULT 3,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "error" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "processedAt" TIMESTAMP(3),
          CONSTRAINT "offline_queue_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('OfflineQueue table already exists');
    }

    // Create UserRateLimit table
    try {
      await prisma.$executeRaw`
        CREATE TABLE "user_rate_limits" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "requests" INTEGER NOT NULL DEFAULT 0,
          "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "lastRequest" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "isBlocked" BOOLEAN NOT NULL DEFAULT false,
          "blockedUntil" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "user_rate_limits_pkey" PRIMARY KEY ("id")
        )
      `;
    } catch (e) {
      console.log('UserRateLimit table already exists');
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
        status: 'APPROVED',
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
        role: 'OBSERVER',
        status: 'APPROVED',
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
    
    // Create sample presidential candidates (HN 2025)
    const candidates = [
      { id: 'candidate-1', name: 'Mario Rivera', party: 'PDC', number: 1 },
      { id: 'candidate-2', name: 'Rixi Moncada', party: 'LIBRE', number: 2 },
      { id: 'candidate-3', name: 'N. Avila', party: 'PINU-SD', number: 3 },
      { id: 'candidate-4', name: 'Salvador Nasralla', party: 'PLH', number: 4 },
      { id: 'candidate-5', name: 'Nasry Asfura', party: 'PNH', number: 5 },
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