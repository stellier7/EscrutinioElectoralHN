import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { AuditLogger } from '@/lib/audit';
import type { RegisterRequest, AuthResponse, ApiResponse, UserRole } from '@/types';

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  role: z.enum(['VOLUNTEER', 'ORGANIZATION_MEMBER'], {
    errorMap: () => ({ message: 'Rol inválido' }),
  }),
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
        error: 'Ya existe un usuario con este email',
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
    const hashedPassword = await AuthUtils.hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role as UserRole,
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
    const token = AuthUtils.generateToken(newUser as any);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Log successful registration
    await AuditLogger.log(
      'LOGIN', // Using LOGIN action for successful registration/login
      `New user registered: ${email}`,
      newUser.id,
      {
        registrationType: 'new_user',
        role: role,
        deviceId: deviceId,
      },
      request
    );

    const response: AuthResponse = {
      user: newUser as any,
      token,
      expiresAt: expiresAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Usuario registrado exitosamente',
    } as ApiResponse<AuthResponse>, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
} 