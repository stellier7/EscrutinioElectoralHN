import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { sendWhatsApp, sendBulkWhatsApp } from '@/lib/whatsapp-service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  eventType: z.string().min(1, 'El tipo de evento es requerido'),
  eventName: z.string().min(1, 'El nombre del evento es requerido'),
  eventDate: z.string().datetime(),
  targetRole: z.enum(['OBSERVER', 'VOLUNTEER']).optional().nullable(),
  targetJrv: z.string().optional().nullable(),
  emailSubject: z.string().optional(),
  emailContent: z.string().optional(),
  whatsappContent: z.string().optional(),
});

async function verifyAdminPermissions(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Token de autorización requerido',
      } as ApiResponse, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    
    if (!decoded.userId) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido',
      } as ApiResponse, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.role !== 'ADMIN' || user.status !== 'APPROVED') {
      return NextResponse.json({
        success: false,
        error: 'Permisos de administrador requeridos',
      } as ApiResponse, { status: 403 });
    }

    return { adminId: decoded.userId };
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Token inválido o expirado',
    } as ApiResponse, { status: 401 });
  }
}

// POST: Crear evento y enviar confirmaciones
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await verifyAdminPermissions(request);
  if ('success' in authResult && !authResult.success) {
    return authResult as NextResponse;
  }

  try {
    const body = await request.json();
    const data = eventSchema.parse(body);
    const eventDate = new Date(data.eventDate);
    const baseUrl = env.APP_BASE_URL || 'http://localhost:3000';

    // Get recipients based on filters
    const where: any = {};
    if (data.targetRole) {
      where.role = data.targetRole;
    }
    if (data.targetJrv) {
      where.jrvNumber = data.targetJrv;
    }

    const applications = await prisma.volunteerApplication.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    // Create confirmations for all recipients
    const confirmations = await Promise.all(
      applications.map(async (app) => {
        const token = crypto.randomBytes(32).toString('hex');
        const confirmationUrl = `${baseUrl}/confirmar/${token}`;

        return prisma.eventConfirmation.create({
          data: {
            applicationId: app.id,
            eventType: data.eventType,
            eventName: data.eventName,
            eventDate,
            confirmationToken: token,
            confirmationUrl,
            status: 'pending',
          },
        });
      })
    );

    // Send notifications if content provided
    let emailResults: any[] = [];
    let whatsappResults: any[] = [];

    // Email service disabled - skip email sending
    if (data.emailSubject && data.emailContent) {
      emailResults = applications.map(() => ({
        success: false,
        error: 'Email service not available',
      }));
    }

    if (data.whatsappContent) {
      whatsappResults = await sendBulkWhatsApp(
        applications.map((app, index) => {
          const confirmation = confirmations[index];
          const message = data.whatsappContent!
            .replace(/\{firstName\}/g, app.firstName)
            .replace(/\{lastName\}/g, app.lastName)
            .replace(/\{eventName\}/g, data.eventName)
            .replace(/\{eventDate\}/g, eventDate.toLocaleDateString('es-HN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }))
            .replace(/\{confirmationUrl\}/g, confirmation.confirmationUrl);

          return {
            to: app.phone,
            message,
          };
        })
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        confirmationsCreated: confirmations.length,
        emailsSent: emailResults.filter(r => r.success).length,
        whatsappSent: whatsappResults.filter(r => r.success).length,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error creating event:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        message: error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }
    return NextResponse.json({
      success: false,
      error: 'Error al crear evento',
    } as ApiResponse, { status: 500 });
  }
}


