import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { AuditLogger } from '@/lib/audit';
import type { ApiResponse } from '@/types';

export const POST = requireAuth(async (request) => {
  try {
    const user = request.user!;

    // Log logout
    await AuditLogger.logLogout(user.id, user.email, request);

    return NextResponse.json({
      success: true,
      message: 'Logout exitoso',
    } as ApiResponse);

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
}); 