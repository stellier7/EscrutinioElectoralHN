import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🔄 Checking and creating database tables and types...');
    
    // Check if tables already exist
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'elections', 'candidates', 'mesas', 'escrutinios', 'votes', 'corrections', 'audit_logs', 'system_configs')
    `;
    
    const existingTables = (tableCheck as any[]).map(row => row.table_name);
    
    if (existingTables.length === 9) {
      console.log('✅ All tables already exist!');
      return NextResponse.json({
        success: true,
        message: 'All database tables already exist',
      } as ApiResponse, { status: 200 });
    }
    
    console.log('📦 Creating missing tables and types...');
    
    // Create enum types first (with error handling)
    try {
      await prisma.$executeRaw`CREATE TYPE "UserRole" AS ENUM ('VOLUNTEER', 'ORGANIZATION_MEMBER', 'ADMIN')`;
    } catch (e) {
      console.log('UserRole enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "ElectionLevel" AS ENUM ('PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL')`;
    } catch (e) {
      console.log('ElectionLevel enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "TransmissionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')`;
    } catch (e) {
      console.log('TransmissionStatus enum already exists');
    }
    
    try {
      await prisma.$executeRaw`CREATE TYPE "AuditLogAction" AS ENUM ('LOGIN', 'LOGOUT', 'START_ESCRUTINIO', 'SUBMIT_RESULTS', 'UPLOAD_EVIDENCE', 'CORRECTION', 'TRANSMISSION', 'VIEW_RESULTS')`;
    } catch (e) {
      console.log('AuditLogAction enum already exists');
    }
    
    // Create tables only if they don't exist
    if (!existingTables.includes('users')) {
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
      await prisma.$executeRaw`CREATE UNIQUE INDEX "users_email_key" ON "users"("email")`;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "users_deviceId_key" ON "users"("deviceId")`;
    }
    
    if (!existingTables.includes('elections')) {
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
    }
    
    if (!existingTables.includes('candidates')) {
      await prisma.$executeRaw`
        CREATE TABLE "candidates" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "party" TEXT,
          "number" INTEGER NOT NULL,
          "electionId" TEXT NOT NULL,
          "electionLevel" "ElectionLevel" NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
        )
      `;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "candidates_electionId_number_electionLevel_key" ON "candidates"("electionId", "number", "electionLevel")`;
    }
    
    if (!existingTables.includes('mesas')) {
      await prisma.$executeRaw`
        CREATE TABLE "mesas" (
          "id" TEXT NOT NULL,
          "number" TEXT NOT NULL,
          "location" TEXT NOT NULL,
          "address" TEXT,
          "latitude" DOUBLE PRECISION,
          "longitude" DOUBLE PRECISION,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
        )
      `;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "mesas_number_key" ON "mesas"("number")`;
    }
    
    if (!existingTables.includes('escrutinios')) {
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
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "escrutinios_pkey" PRIMARY KEY ("id")
        )
      `;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "escrutinios_userId_electionId_mesaId_electionLevel_key" ON "escrutinios"("userId", "electionId", "mesaId", "electionLevel")`;
    }
    
    if (!existingTables.includes('votes')) {
      await prisma.$executeRaw`
        CREATE TABLE "votes" (
          "id" TEXT NOT NULL,
          "escrutinioId" TEXT NOT NULL,
          "candidateId" TEXT NOT NULL,
          "votes" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
        )
      `;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "votes_escrutinioId_candidateId_key" ON "votes"("escrutinioId", "candidateId")`;
    }
    
    if (!existingTables.includes('corrections')) {
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
    }
    
    if (!existingTables.includes('audit_logs')) {
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
    }
    
    if (!existingTables.includes('system_configs')) {
      await prisma.$executeRaw`
        CREATE TABLE "system_configs" (
          "id" TEXT NOT NULL,
          "key" TEXT NOT NULL,
          "value" JSONB NOT NULL,
          "description" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
        )
      `;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key")`;
    }
    
    console.log('✅ Database setup completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
    } as ApiResponse, { status: 200 });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to setup database',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as ApiResponse, { status: 500 });
  }
} 