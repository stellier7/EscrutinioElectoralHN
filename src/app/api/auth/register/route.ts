import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditLogger } from '../../../../lib/audit';
import type { RegisterRequest, AuthResponse, ApiResponse, UserRole } from '@/types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

// Using shared Prisma client from lib/prisma

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().optional(),
  jrvNumber: z.string().optional(),
  acceptTerms: z.boolean().optional(), // Validated on frontend, ignored here
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

    const { email, password, name, phone, jrvNumber } = validationResult.data;

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

    // No device association required

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with APPROVED status (no approval required)
    // All users register as VOLUNTEER by default
    // Store jrvNumber in organization field (as per user decision)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'VOLUNTEER', // Always VOLUNTEER
        status: 'APPROVED', // Users are approved immediately
        phone: phone || null,
        organization: jrvNumber || null, // Store JRV in organization field
        deviceId: null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        organization: true,
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
    }, env.JWT_SECRET, {
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
      message: 'Usuario registrado exitosamente. Tu cuenta ha sido creada y está lista para usar.',
    } as ApiResponse<AuthResponse>);

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
} 