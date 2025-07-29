import { NextRequest, NextResponse } from 'next/server';
// Import the seed function directly
const { seedProduction } = require('../../../../scripts/seed-production');

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check if it's a production environment
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: false,
        error: 'Seed endpoint only available in production',
      }, { status: 403 });
    }

    // Check for a secret key to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Missing or invalid authorization header',
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const expectedToken = process.env.SEED_SECRET || 'default-seed-secret';
    
    if (token !== expectedToken) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Invalid token',
      }, { status: 401 });
    }

    console.log('🌱 Starting production seed via API...');
    
    await seedProduction();

    return NextResponse.json({
      success: true,
      message: 'Production seed completed successfully',
      credentials: {
        admin: 'admin@escrutinio.com / admin123',
        auditor: 'auditor@escrutinio.com / auditor123',
      },
    });

  } catch (error) {
    console.error('❌ Error during production seed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run production seed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 