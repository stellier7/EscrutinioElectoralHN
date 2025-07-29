import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { AuditLogger } from '@/lib/audit';
import type { ApiResponse } from '@/types';

import { prisma } from '@/lib/prisma';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email requerido',
      } as ApiResponse, { status: 400 });
    }

    // Find user and unlink device
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado',
      } as ApiResponse, { status: 404 });
    }

    // Unlink device
    await prisma.user.update({
      where: { email },
      data: { deviceId: null },
    });

    return NextResponse.json({
      success: true,
      message: `Dispositivo desvinculado para ${email}. Ahora puedes iniciar sesión.`,
    } as ApiResponse);

  } catch (error) {
    console.error('Unlink error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
} 