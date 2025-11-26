import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { env } from '@/config/env';
import jwt from 'jsonwebtoken';
import type { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

async function verifyAdminPermissions(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado',
      } as ApiResponse, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as any;

    // Verificar que sea admin
    const admin = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, status: true, isActive: true },
    });

    if (!admin || admin.role !== 'ADMIN' || admin.status !== 'APPROVED' || !admin.isActive) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado - Se requieren permisos de administrador',
      } as ApiResponse, { status: 403 });
    }

    return { adminId: admin.id };
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Token inválido',
    } as ApiResponse, { status: 401 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // Verificar permisos de admin
    const adminCheck = await verifyAdminPermissions(request);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { id: userId } = params;

    // Validar datos
    const body = await request.json();
    const validationResult = changePasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        message: validationResult.error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }

    const { newPassword } = validationResult.data;

    // Verificar que el usuario existe
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true },
    });

    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado',
      } as ApiResponse, { status: 404 });
    }

    // Hashear nueva contraseña
    const hashedPassword = await AuthUtils.hashPassword(newPassword);

    // Actualizar contraseña
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        // Limpiar tokens de recuperación si existen
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Contraseña actualizada exitosamente para ${targetUser.email}`,
    } as ApiResponse);

  } catch (error: any) {
    console.error('Admin change password error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
}

