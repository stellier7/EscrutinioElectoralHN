import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, User } from '@/types';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

export const GET = requireAuth(async (request) => {
  try {
    const userId = request.user!.id;

    // Get complete user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deviceId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado',
      } as ApiResponse, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Perfil de usuario obtenido exitosamente',
    } as ApiResponse<User>);

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
}); 