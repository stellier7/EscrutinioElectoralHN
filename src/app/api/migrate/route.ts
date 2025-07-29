import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🔄 Running database migrations...');
    
    // Use prisma db push instead of migrate deploy
    execSync('npx prisma db push', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    console.log('✅ Database migrations completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Database migrations completed successfully',
    } as ApiResponse, { status: 200 });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run migrations',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as ApiResponse, { status: 500 });
  }
} 