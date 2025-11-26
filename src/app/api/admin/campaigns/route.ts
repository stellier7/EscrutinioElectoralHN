import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiResponse, PaginatedResponse } from '@/types';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { sendBulkWhatsApp } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

const campaignSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  eventType: z.string().optional(),
  eventDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  emailSubject: z.string().optional(),
  emailContent: z.string().optional(),
  whatsappContent: z.string().optional(),
  targetRole: z.enum(['OBSERVER', 'VOLUNTEER']).optional().nullable(),
  targetJrv: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
});

const campaignFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
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

// GET: Listar campañas
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await verifyAdminPermissions(request);
  if ('success' in authResult && !authResult.success) {
    return authResult as NextResponse;
  }

  const { adminId } = authResult as { adminId: string };

  try {
    const { searchParams } = new URL(request.url);
    const filters = campaignFiltersSchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      status: searchParams.get('status') || undefined,
    });

    const where: any = {};
    if (filters.status) {
      where.status = filters.status;
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          recipients: {
            select: {
              id: true,
              emailSent: true,
              emailDelivered: true,
              whatsappSent: true,
              whatsappDelivered: true,
            },
          },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    const totalPages = Math.ceil(total / filters.limit);

    const response: PaginatedResponse<any> = {
      data: campaigns.map(campaign => ({
        ...campaign,
        recipientsCount: campaign.recipients.length,
        emailsSent: campaign.recipients.filter(r => r.emailSent).length,
        emailsDelivered: campaign.recipients.filter(r => r.emailDelivered).length,
        whatsappSent: campaign.recipients.filter(r => r.whatsappSent).length,
        whatsappDelivered: campaign.recipients.filter(r => r.whatsappDelivered).length,
        recipients: undefined, // Remove recipients array from response
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };

    return NextResponse.json({
      success: true,
      data: response,
    } as ApiResponse<PaginatedResponse<any>>);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al obtener campañas',
    } as ApiResponse, { status: 500 });
  }
}

// POST: Crear nueva campaña
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await verifyAdminPermissions(request);
  if ('success' in authResult && !authResult.success) {
    return authResult as NextResponse;
  }

  const { adminId } = authResult as { adminId: string };

  try {
    const body = await request.json();
    const data = campaignSchema.parse(body);

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

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        createdBy: adminId,
        totalRecipients: applications.length,
        status: data.scheduledAt ? 'scheduled' : 'draft',
      },
    });

    // Create recipients
    await prisma.campaignRecipient.createMany({
      data: applications.map(app => ({
        campaignId: campaign.id,
        applicationId: app.id,
        email: app.email,
        phone: app.phone,
        firstName: app.firstName,
        lastName: app.lastName,
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        ...campaign,
        recipientsCount: applications.length,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        message: error.errors[0].message,
      } as ApiResponse, { status: 400 });
    }
    return NextResponse.json({
      success: false,
      error: 'Error al crear campaña',
    } as ApiResponse, { status: 500 });
  }
}


