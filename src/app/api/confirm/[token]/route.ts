import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({
  status: z.enum(['confirmed', 'declined', 'maybe']),
  notes: z.string().optional(),
});

// GET: Obtener información de confirmación
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  try {
    const confirmation = await prisma.eventConfirmation.findUnique({
      where: { confirmationToken: params.token },
      include: {
        application: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!confirmation) {
      return NextResponse.json({
        success: false,
        error: 'Token de confirmación no válido',
      } as ApiResponse, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: confirmation.id,
        eventName: confirmation.eventName,
        eventDate: confirmation.eventDate,
        eventType: confirmation.eventType,
        status: confirmation.status,
        firstName: confirmation.application.firstName,
        lastName: confirmation.application.lastName,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching confirmation:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al obtener información de confirmación',
    } as ApiResponse, { status: 500 });
  }
}

// POST: Confirmar asistencia
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  try {
    const confirmation = await prisma.eventConfirmation.findUnique({
      where: { confirmationToken: params.token },
    });

    if (!confirmation) {
      return NextResponse.json({
        success: false,
        error: 'Token de confirmación no válido',
      } as ApiResponse, { status: 404 });
    }

    const body = await request.json();
    const data = confirmSchema.parse(body);

    const updateData: any = {
      status: data.status,
      notes: data.notes || null,
    };

    if (data.status === 'confirmed') {
      updateData.confirmedAt = new Date();
      updateData.declinedAt = null;
    } else if (data.status === 'declined') {
      updateData.declinedAt = new Date();
      updateData.confirmedAt = null;
    } else {
      updateData.confirmedAt = null;
      updateData.declinedAt = null;
    }

    const updated = await prisma.eventConfirmation.update({
      where: { id: confirmation.id },
      data: updateData,
      include: {
        application: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: data.status === 'confirmed' 
          ? '¡Gracias por confirmar tu asistencia!'
          : data.status === 'declined'
          ? 'Lamentamos que no puedas asistir. Gracias por avisarnos.'
          : 'Hemos registrado tu respuesta. Te confirmaremos más detalles pronto.',
        confirmation: updated,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error confirming attendance:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        message: error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }
    return NextResponse.json({
      success: false,
      error: 'Error al confirmar asistencia',
    } as ApiResponse, { status: 500 });
  }
}


