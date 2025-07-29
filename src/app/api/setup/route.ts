import { NextRequest, NextResponse } from 'next/server';
import { seedProduction } from '../../../../scripts/seed-production';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🌱 Starting setup via API...');
    
    await seedProduction();

    return NextResponse.json({
      success: true,
      message: 'Setup completed successfully',
      credentials: {
        admin: 'admin@escrutinio.com / admin123',
        auditor: 'auditor@escrutinio.com / auditor123',
      },
      note: 'Users are now available for login. Device linking is disabled for these users.',
    });

  } catch (error) {
    console.error('❌ Error during setup:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run setup',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 