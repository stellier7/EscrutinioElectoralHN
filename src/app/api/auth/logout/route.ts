import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { AuditLogger } from '@/lib/audit';
import type { ApiResponse } from '@/types';

import { prisma } from '@/lib/prisma';

export const POST = requireAuth(async (request) => {
  try {
    const user = request.user!;

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
}); 