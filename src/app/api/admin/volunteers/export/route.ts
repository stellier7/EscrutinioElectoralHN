import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

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

    return null;
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Token inválido o expirado',
    } as ApiResponse, { status: 401 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await verifyAdminPermissions(request);
  if (authError) return authError;

  try {
    const applications = await prisma.volunteerApplication.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Generate CSV
    const headers = [
      'ID',
      'Nombre',
      'Apellido',
      'Email',
      'Teléfono',
      'Rol',
      'JRV',
      'Comentarios',
      'Fecha de Solicitud',
    ];

    const rows = applications.map((app: any) => [
      app.id,
      app.firstName,
      app.lastName,
      app.email,
      app.phone,
      app.role === 'OBSERVER' ? 'Observador' : 'Voluntario',
      app.jrvNumber || '',
      app.comments ? app.comments.replace(/"/g, '""') : '',
      app.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(',')),
    ].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="volunteer-applications-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting volunteer applications:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al exportar solicitudes',
    } as ApiResponse, { status: 500 });
  }
}

