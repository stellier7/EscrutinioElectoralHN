import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

// Using shared Prisma client from lib/prisma

// Auth function
function verifyToken(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  return jwt.verify(token, env.JWT_SECRET)
}

// Simple audit logging function
async function logLogout(userId: string, email: string, request: NextRequest) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        description: `User ${email} logged out`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

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

    // Log unlink
    await logLogout(user.id, user.email, request);

    return NextResponse.json({
      success: true,
      message: 'Dispositivo desvinculado exitosamente',
    } as ApiResponse);

  } catch (error) {
    console.error('Unlink error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
} 