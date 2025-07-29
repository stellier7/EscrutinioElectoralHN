import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuditLogger } from '@/lib/audit';
import type { RegisterRequest, AuthResponse, ApiResponse, UserRole } from '@/types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

// Create Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  role: z.enum(['VOLUNTEER', 'ORGANIZATION_MEMBER', 'ADMIN'] as const),
  deviceId: z.string().min(1, 'ID de dispositivo requerido'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        message: validationResult.error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }

    const { email, password, name, role, deviceId }: RegisterRequest = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'El usuario ya existe',
      } as ApiResponse, { status: 409 });
    }

    // Check if device is already associated
    const existingDevice = await prisma.user.findUnique({
      where: { deviceId },
    });

    if (existingDevice) {
      return NextResponse.json({
        success: false,
        error: 'Este dispositivo ya está asociado a otro usuario',
      } as ApiResponse, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        deviceId,
        isActive: true,
      },
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

    // Generate JWT token
    const token = jwt.sign({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      deviceId: newUser.deviceId,
    }, process.env.JWT_SECRET!, {
      expiresIn: '24h',
      issuer: 'escrutinio-transparente',
      audience: 'escrutinio-users',
    });

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Log registration
    await AuditLogger.logLogin(newUser.id, email, true, request);

    const response: AuthResponse = {
      user: newUser as any,
      token,
      expiresAt: expiresAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Usuario registrado exitosamente',
    } as ApiResponse<AuthResponse>);

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
} 