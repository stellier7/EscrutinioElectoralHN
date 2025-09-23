import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AuditLogger } from '../../../../lib/audit';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Middleware para verificar permisos de admin
async function verifyAdminPermissions(request: NextRequest) {
  try {
    // Extraer token del header Authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Token de autorización requerido',
      } as ApiResponse, { status: 401 });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '
    
    // Verificar y decodificar el token JWT
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    
    if (!decoded.userId) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido',
      } as ApiResponse, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, status: true },
    });

    if (!adminUser || adminUser.role !== 'ADMIN' || adminUser.status !== 'APPROVED') {
      return NextResponse.json({
        success: false,
        error: 'Permisos de administrador requeridos',
      } as ApiResponse, { status: 403 });
    }

    return { adminId: decoded.userId };
  } catch (error) {
    console.error('Error verifying admin permissions:', error);
    return NextResponse.json({
      success: false,
      error: 'Error de autenticación',
    } as ApiResponse, { status: 500 });
  }
}

// GET: Obtener estadísticas de usuarios
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verificar permisos de admin
    const adminCheck = await verifyAdminPermissions(request);
    if (adminCheck instanceof NextResponse) return adminCheck;
    const { adminId } = adminCheck;

    // Obtener estadísticas de usuarios por estado
    const userStatsByStatus = await prisma.user.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    // Obtener estadísticas de usuarios por rol
    const userStatsByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        id: true,
      },
    });

    // Obtener estadísticas de usuarios por estado y rol
    const userStatsByStatusAndRole = await prisma.user.groupBy({
      by: ['status', 'role'],
      _count: {
        id: true,
      },
    });

    // Obtener usuarios recientes (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Obtener usuarios pendientes más antiguos
    const oldestPendingUsers = await prisma.user.findMany({
      where: {
        status: 'PENDING',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 5,
    });

    // Obtener actividad de escrutinios por usuarios aprobados
    const escrutinioStats = await prisma.escrutinio.groupBy({
      by: ['userId'],
      _count: {
        id: true,
      },
      where: {
        user: {
          status: 'APPROVED',
        },
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // Obtener información de usuarios más activos
    const mostActiveUsers = await prisma.user.findMany({
      where: {
        id: {
          in: escrutinioStats.map(stat => stat.userId),
        },
        status: 'APPROVED',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            escrutinios: true,
          },
        },
      },
      orderBy: {
        escrutinios: {
          _count: 'desc',
        },
      },
      take: 10,
    });

    // Formatear estadísticas
    const stats = {
      usersByStatus: userStatsByStatus.reduce((acc, stat) => {
        acc[stat.status] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      
      usersByRole: userStatsByRole.reduce((acc, stat) => {
        acc[stat.role] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      
      usersByStatusAndRole: userStatsByStatusAndRole.reduce((acc, stat) => {
        const key = `${stat.status}_${stat.role}`;
        acc[key] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      
      recentUsers,
      oldestPendingUsers,
      mostActiveUsers,
      
      totals: {
        total: userStatsByStatus.reduce((sum, stat) => sum + stat._count.id, 0),
        pending: userStatsByStatus.find(stat => stat.status === 'PENDING')?._count.id || 0,
        approved: userStatsByStatus.find(stat => stat.status === 'APPROVED')?._count.id || 0,
        rejected: userStatsByStatus.find(stat => stat.status === 'REJECTED')?._count.id || 0,
        suspended: userStatsByStatus.find(stat => stat.status === 'SUSPENDED')?._count.id || 0,
      },
    };

    // Log de auditoría
    try {
      await AuditLogger.log('VIEW_RESULTS', 'Estadísticas de usuarios consultadas', adminId, undefined, request);
    } catch (auditError) {
      console.error('Audit logging error:', auditError);
    }

    return NextResponse.json({
      success: true,
      data: stats,
      message: 'Estadísticas obtenidas exitosamente',
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
}
