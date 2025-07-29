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
      AND table_name IN ('users', 'elections', 'candidates', 'escrutinios', 'votes', 'audit_logs')
    `;
    
    const existingTables = (tableCheck as any[]).map(row => row.table_name);
    
    if (existingTables.length === 6) {
      console.log('✅ All tables already exist!');
      return NextResponse.json({
        success: true,
        message: 'All database tables already exist',
      } as ApiResponse, { status: 200 });
    }
    
    console.log('📦 Creating missing tables and types...');
    
    // Create enum types first (with error handling)
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
    }
    
    if (!existingTables.includes('elections')) {
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
    }
    
    if (!existingTables.includes('candidates')) {
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
    }
    
    if (!existingTables.includes('escrutinios')) {
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
    }
    
    if (!existingTables.includes('votes')) {
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
    }
    
    if (!existingTables.includes('audit_logs')) {
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