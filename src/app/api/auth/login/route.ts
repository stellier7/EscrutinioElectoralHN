import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditLogger } from '../../../../lib/audit';
import type { LoginRequest, AuthResponse, ApiResponse } from '@/types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

// Using shared Prisma client from lib/prisma

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
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

    const { email, password }: LoginRequest = validationResult.data;

    // Find user by email with better error handling and retry logic
    let user;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            role: true,
            status: true,
            deviceId: true,
            isActive: true,
            rejectionReason: true,
          },
        });
        break; // Si la consulta es exitosa, salir del loop
      } catch (dbError) {
        retryCount++;
        console.error(`Database error during login (attempt ${retryCount}/${maxRetries}):`, dbError);
        
        if (retryCount >= maxRetries) {
          return NextResponse.json({
            success: false,
            error: 'Error de conexión con la base de datos. Por favor, intenta de nuevo en unos momentos.',
          } as ApiResponse, { status: 503 }); // 503 Service Unavailable
        }
        
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
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
    const isPasswordValid = await bcrypt.compare(password, user.password);
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

    // Verificar estado del usuario
    if (user.status === 'PENDING') {
      try {
        await AuditLogger.logLogin(user.id, email, false, request);
      } catch (auditError) {
        console.error('Audit logging error:', auditError);
      }
      return NextResponse.json({
        success: false,
        error: 'Tu cuenta está pendiente de aprobación. Un administrador revisará tu solicitud pronto.',
        requiresApproval: true,
      } as ApiResponse, { status: 403 });
    }

    if (user.status === 'REJECTED') {
      try {
        await AuditLogger.logLogin(user.id, email, false, request);
      } catch (auditError) {
        console.error('Audit logging error:', auditError);
      }
      return NextResponse.json({
        success: false,
        error: `Tu cuenta ha sido rechazada. ${user.rejectionReason ? `Razón: ${user.rejectionReason}` : ''}`,
        isRejected: true,
      } as ApiResponse, { status: 403 });
    }

    if (user.status === 'SUSPENDED') {
      try {
        await AuditLogger.logLogin(user.id, email, false, request);
      } catch (auditError) {
        console.error('Audit logging error:', auditError);
      }
      return NextResponse.json({
        success: false,
        error: 'Tu cuenta ha sido suspendida temporalmente. Contacta al administrador.',
        isSuspended: true,
      } as ApiResponse, { status: 403 });
    }

    // No device association required

    // Generate JWT token
    const token = jwt.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    }, env.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'escrutinio-transparente',
      audience: 'escrutinio-users',
    });

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
        status: user.status,
        deviceId: null,
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
    
    // Determinar el tipo de error y responder apropiadamente
    if (error instanceof Error) {
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        return NextResponse.json({
          success: false,
          error: 'Error de conexión con la base de datos. Por favor, intenta de nuevo en unos momentos.',
        } as ApiResponse, { status: 503 });
      }
      
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        return NextResponse.json({
          success: false,
          error: 'Servicio temporalmente no disponible. Por favor, intenta de nuevo más tarde.',
        } as ApiResponse, { status: 503 });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor. Por favor, intenta de nuevo.',
    } as ApiResponse, { status: 500 });
  }
} 