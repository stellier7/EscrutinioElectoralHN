import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { AuditLogger } from '@/lib/audit';
import type { LoginRequest, AuthResponse, ApiResponse } from '@/types';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  deviceId: z.string().min(1, 'ID de dispositivo requerido'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        message: validationResult.error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }

    const { email, password, deviceId }: LoginRequest = validationResult.data;

    // Find user by email with better error handling
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          role: true,
          deviceId: true,
          isActive: true,
        },
      });
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Error de conexión con la base de datos',
      } as ApiResponse, { status: 500 });
    }

    if (!user || !user.isActive) {
      try {
        await AuditLogger.logLogin('', email, false, request);
      } catch (auditError) {
        console.error('Audit logging error:', auditError);
      }
      return NextResponse.json({
        success: false,
        error: 'Credenciales inválidas',
      } as ApiResponse, { status: 401 });
    }

    // Verify password
    const isPasswordValid = await AuthUtils.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      try {
        await AuditLogger.logLogin('', email, false, request);
      } catch (auditError) {
        console.error('Audit logging error:', auditError);
      }
      return NextResponse.json({
        success: false,
        error: 'Credenciales inválidas',
      } as ApiResponse, { status: 401 });
    }

    // Associate device if not already associated
    if (!user.deviceId) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { deviceId },
        });
      } catch (updateError) {
        console.error('Error updating device ID:', updateError);
        // Continue with login even if device update fails
      }
    }

    // Generate JWT token
    const token = AuthUtils.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      deviceId: deviceId,
    } as any);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Log successful login
    try {
      await AuditLogger.logLogin(user.id, email, true, request);
    } catch (auditError) {
      console.error('Audit logging error:', auditError);
      // Continue with login even if audit logging fails
    }

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        deviceId: deviceId,
        isActive: user.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      token,
      expiresAt: expiresAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Login exitoso',
    } as ApiResponse<AuthResponse>);

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
} 