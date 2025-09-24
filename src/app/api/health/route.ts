import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db-health';

export async function GET() {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    if (!dbHealth.isHealthy) {
      return NextResponse.json({
        status: 'unhealthy',
        database: dbHealth,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
    
    return NextResponse.json({
      status: 'healthy',
      database: dbHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
