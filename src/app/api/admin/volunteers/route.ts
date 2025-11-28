import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiResponse, PaginatedResponse } from '@/types';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';

const volunteerFiltersSchema = z.object({
  search: z.string().optional(),
  jrvNumber: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
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
    
    const filters = volunteerFiltersSchema.parse({
      search: searchParams.get('search') || undefined,
      jrvNumber: searchParams.get('jrvNumber') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    });

    const where: any = {
      role: 'VOLUNTEER', // Solo usuarios con role VOLUNTEER
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.jrvNumber) {
      where.organization = {
        contains: filters.jrvNumber,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          organization: true, // JRV está almacenado aquí
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / filters.limit);

    const response: PaginatedResponse<any> = {
      data: users,
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
    console.error('Error fetching volunteers:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al obtener voluntarios',
    } as ApiResponse, { status: 500 });
  }
}

