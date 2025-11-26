import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { env } from '@/config/env';
import jwt from 'jsonwebtoken';
import type { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
});

function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token no proporcionado');
  }
  const token = authHeader.substring(7);
  return jwt.verify(token, env.JWT_SECRET);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verificar autenticación
    const payload = verifyToken(request);
    const userId = (payload as any).userId;

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

    const { currentPassword, newPassword } = validationResult.data;

    // Obtener usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado o inactivo',
      } as ApiResponse, { status: 404 });
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await AuthUtils.verifyPassword(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json({
        success: false,
        error: 'La contraseña actual es incorrecta',
      } as ApiResponse, { status: 401 });
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await AuthUtils.verifyPassword(
      newPassword,
      user.password
    );

    if (isSamePassword) {
      return NextResponse.json({
        success: false,
        error: 'La nueva contraseña debe ser diferente a la actual',
      } as ApiResponse, { status: 400 });
    }

    // Hashear nueva contraseña
    const hashedPassword = await AuthUtils.hashPassword(newPassword);

    // Actualizar contraseña
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    } as ApiResponse);

  } catch (error: any) {
    console.error('Change password error:', error);
    
    if (error.message === 'Token no proporcionado' || error.message.includes('jwt')) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado',
      } as ApiResponse, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
}

