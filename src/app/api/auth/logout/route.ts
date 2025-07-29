import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/middleware/auth';
import { AuditLogger } from '@/lib/audit';
import type { ApiResponse } from '@/types';

import { prisma } from '@/lib/prisma';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify token
    const payload = verifyToken(request);
    const userId = (payload as any).userId;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, deviceId: true }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado',
      } as ApiResponse, { status: 404 });
    }

    // Remove device association
    await prisma.user.update({
      where: { id: user.id },
      data: { deviceId: null },
    });

    // Log logout
    await AuditLogger.logLogout(user.id, user.email, request);

    return NextResponse.json({
      success: true,
      message: 'Logout exitoso - Dispositivo desvinculado',
    } as ApiResponse);

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
} 