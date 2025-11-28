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
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('type') || 'full'; // 'emails', 'phones', or 'full'

    // Get all volunteers (Users with role VOLUNTEER)
    const users = await prisma.user.findMany({
      where: {
        role: 'VOLUNTEER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        organization: true, // JRV está almacenado aquí
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let csvContent: string;
    let filename: string;

    if (exportType === 'emails') {
      // Solo emails
      const emails = users
        .filter(user => user.email)
        .map(user => user.email);
      
      csvContent = ['Email', ...emails].join('\n');
      filename = `volunteers-emails-${new Date().toISOString().split('T')[0]}.csv`;
    } else if (exportType === 'phones') {
      // Solo teléfonos
      const phones = users
        .filter(user => user.phone)
        .map(user => user.phone);
      
      csvContent = ['Teléfono', ...phones].join('\n');
      filename = `volunteers-phones-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      // Completo - toda la información
      const headers = [
        'ID',
        'Nombre',
        'Email',
        'Teléfono',
        'JRV',
        'Status',
        'Fecha de Registro',
      ];

      const rows = users.map((user: any) => [
        user.id,
        user.name || '',
        user.email || '',
        user.phone || '',
        user.organization || '', // JRV
        user.status || '',
        user.createdAt ? new Date(user.createdAt).toISOString() : '',
      ]);

      csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      filename = `volunteers-complete-${new Date().toISOString().split('T')[0]}.csv`;
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting volunteers:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al exportar voluntarios',
    } as ApiResponse, { status: 500 });
  }
}

