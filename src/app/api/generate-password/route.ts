import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '../../../lib/auth';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminPassword = await AuthUtils.hashPassword('admin123');
    const auditorPassword = await AuthUtils.hashPassword('auditor123');
    
    return NextResponse.json({
      admin: adminPassword,
      auditor: auditorPassword,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate passwords' }, { status: 500 });
  }
} 