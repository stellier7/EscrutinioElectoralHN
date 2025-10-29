import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

const volunteerApplicationSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(8, 'El teléfono debe tener al menos 8 caracteres'),
  role: z.enum(['OBSERVER', 'VOLUNTEER']).default('VOLUNTEER'),
  jrvNumber: z.string().optional(),
  comments: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = volunteerApplicationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        message: validationResult.error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }

    const { firstName, lastName, email, phone, role, jrvNumber, comments } = validationResult.data;

    // Create volunteer application
    const application = await prisma.volunteerApplication.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        role,
        jrvNumber: jrvNumber || null,
        comments: comments || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: application.id,
        message: 'Tu solicitud ha sido enviada exitosamente. Nos pondremos en contacto contigo pronto.',
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Volunteer application error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al enviar la solicitud. Por favor intenta de nuevo.',
    } as ApiResponse, { status: 500 });
  }
}

