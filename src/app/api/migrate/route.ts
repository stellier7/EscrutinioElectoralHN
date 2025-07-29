import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🔄 Creating database tables...');
    
    // Create tables directly using SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'VOLUNTEER',
        "deviceId" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      );
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "elections" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "level" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
      );
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "candidates" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "party" TEXT,
        "electionId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
      );
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "escrutinios" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "electionId" TEXT NOT NULL,
        "mesa" TEXT NOT NULL,
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "accuracy" DOUBLE PRECISION,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "escrutinios_pkey" PRIMARY KEY ("id")
      );
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "votes" (
        "id" TEXT NOT NULL,
        "escrutinioId" TEXT NOT NULL,
        "candidateId" TEXT NOT NULL,
        "count" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
      );
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "userId" TEXT,
        "metadata" JSONB,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
      );
    `;
    
    console.log('✅ Database tables created successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully',
    } as ApiResponse, { status: 200 });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create tables',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as ApiResponse, { status: 500 });
  }
} 