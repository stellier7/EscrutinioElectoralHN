import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId;
    const userRole = payload.role;

    // Obtener estadísticas generales (todos los usuarios ven números globales)
    const totalMesas = await prisma.mesa.count({
      where: { isActive: true },
    });

    const completedEscrutinios = await prisma.escrutinio.count({
      where: { 
        status: 'COMPLETED',
        // Todos los usuarios ven estadísticas globales
      },
    });

    const pendingEscrutinios = await prisma.escrutinio.count({
      where: { 
        status: { not: 'COMPLETED' },
        // Todos los usuarios ven estadísticas globales
      },
    });

    // Obtener escrutinios en progreso (no cerrados, ni finalizados, ni cancelados)
    const inProgressEscrutinios = await prisma.escrutinio.findMany({
      where: {
        status: 'COMPLETED', // En progreso (no cerrado)
        completedAt: null, // No finalizado
        // Excluir escrutinios cancelados (FAILED)
        ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Solo admins ven todos
      },
      include: {
        mesa: true,
        election: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Obtener escrutinios finalizados (para revisar)
    const completedEscrutiniosList = await prisma.escrutinio.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null }, // Solo los que tienen fecha de completado
        ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Solo admins ven todos
      },
      include: {
        mesa: true,
        election: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: 5,
    });

    const inProgressActivity = inProgressEscrutinios.map(escrutinio => ({
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.location,
      department: escrutinio.mesa.department,
      electionLevel: escrutinio.electionLevel,
      status: 'IN_PROGRESS',
      createdAt: escrutinio.createdAt,
    }));

    const recentActivity = completedEscrutiniosList.map(escrutinio => ({
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.location,
      department: escrutinio.mesa.department,
      electionLevel: escrutinio.electionLevel,
      status: 'COMPLETED',
      completedAt: escrutinio.completedAt,
    }));

    // Obtener estadísticas por nivel electoral (todos ven números globales)
    const statsByLevel = await Promise.all(
      ['PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL'].map(async (level) => {
        const completed = await prisma.escrutinio.count({
          where: {
            status: 'COMPLETED',
            electionLevel: level as any,
            // Todos los usuarios ven estadísticas globales
          },
        });

        const pending = await prisma.escrutinio.count({
          where: {
            status: { not: 'COMPLETED' },
            electionLevel: level as any,
            // Todos los usuarios ven estadísticas globales
          },
        });

        return {
          level,
          completed,
          pending,
          total: completed + pending,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        totalMesas,
        completedEscrutinios,
        pendingEscrutinios,
        inProgressActivity,
        recentActivity,
        statsByLevel,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
