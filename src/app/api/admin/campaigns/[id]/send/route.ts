import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { sendBulkWhatsApp } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

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

// POST: Enviar campaña
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const authResult = await verifyAdminPermissions(request);
  if ('success' in authResult && !authResult.success) {
    return authResult as NextResponse;
  }

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        recipients: {
          where: {
            emailSent: false,
            whatsappSent: false,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({
        success: false,
        error: 'Campaña no encontrada',
      } as ApiResponse, { status: 404 });
    }

    if (campaign.status === 'sending' || campaign.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'La campaña ya fue enviada o está en proceso de envío',
      } as ApiResponse, { status: 400 });
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: params.id },
      data: { status: 'sending' },
    });

    // Email service disabled - skip email sending
    let emailResults: any[] = [];
    if (campaign.emailSubject && campaign.emailContent) {
      const emailRecipients = campaign.recipients.filter(r => r.email);
      if (emailRecipients.length > 0) {
        // Email service not available - mark all as not sent
        emailResults = emailRecipients.map(() => ({
          success: false,
          error: 'Email service not available',
        }));

        // Update email status
        await Promise.all(
          emailRecipients.map((recipient) => {
            return prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                emailSent: false,
                emailDelivered: false,
                emailError: 'Email service not available',
                sentAt: new Date(),
                deliveredAt: null,
              },
            });
          })
        );
      }
    }

    // Send WhatsApp if WhatsApp content exists
    let whatsappResults: any[] = [];
    if (campaign.whatsappContent) {
      const whatsappRecipients = campaign.recipients.filter(r => r.phone);
      if (whatsappRecipients.length > 0) {
        whatsappResults = await sendBulkWhatsApp(
          whatsappRecipients.map(r => ({
            to: r.phone!,
            message: campaign.whatsappContent!,
          }))
        );

        // Update WhatsApp status
        await Promise.all(
          whatsappRecipients.map((recipient, index) => {
            const result = whatsappResults[index];
            return prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                whatsappSent: result.success,
                whatsappDelivered: result.success,
                whatsappError: result.error || null,
                sentAt: new Date(),
                deliveredAt: result.success ? new Date() : null,
              },
            });
          })
        );
      }
    }

    // Update campaign statistics
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: params.id },
      select: {
        emailSent: true,
        emailDelivered: true,
        whatsappSent: true,
        whatsappDelivered: true,
      },
    });

    const stats = {
      emailsSent: recipients.filter(r => r.emailSent).length,
      emailsDelivered: recipients.filter(r => r.emailDelivered).length,
      whatsappSent: recipients.filter(r => r.whatsappSent).length,
      whatsappDelivered: recipients.filter(r => r.whatsappDelivered).length,
    };

    await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: 'completed',
        sentAt: new Date(),
        emailsSent: stats.emailsSent,
        emailsDelivered: stats.emailsDelivered,
        whatsappSent: stats.whatsappSent,
        whatsappDelivered: stats.whatsappDelivered,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        emailsSent: emailResults.filter(r => r.success).length,
        emailsFailed: emailResults.filter(r => !r.success).length,
        whatsappSent: whatsappResults.filter(r => r.success).length,
        whatsappFailed: whatsappResults.filter(r => !r.success).length,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error sending campaign:', error);
    await prisma.campaign.update({
      where: { id: params.id },
      data: { status: 'draft' },
    }).catch(() => {});
    
    return NextResponse.json({
      success: false,
      error: 'Error al enviar campaña',
    } as ApiResponse, { status: 500 });
  }
}

