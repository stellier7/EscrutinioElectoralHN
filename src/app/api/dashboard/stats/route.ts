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

    // Obtener estadísticas generales
    const totalMesas = await prisma.mesa.count({
      where: { isActive: true },
    });

    const completedEscrutinios = await prisma.escrutinio.count({
      where: { 
        isCompleted: true,
        ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Solo admins ven todos
      },
    });

    const pendingEscrutinios = await prisma.escrutinio.count({
      where: { 
        isCompleted: false,
        ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Solo admins ven todos
      },
    });

    // Obtener escrutinios recientes (solo del usuario actual, excepto para admins)
    const recentEscrutinios = await prisma.escrutinio.findMany({
      where: {
        isCompleted: true,
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

    const recentActivity = recentEscrutinios.map(escrutinio => ({
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.location,
      department: escrutinio.mesa.department,
      electionLevel: escrutinio.electionLevel,
      completedAt: escrutinio.completedAt,
    }));

    // Obtener estadísticas por nivel electoral
    const statsByLevel = await Promise.all(
      ['PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL'].map(async (level) => {
        const completed = await prisma.escrutinio.count({
          where: {
            isCompleted: true,
            electionLevel: level as any,
            ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Solo admins ven todos
          },
        });

        const pending = await prisma.escrutinio.count({
          where: {
            isCompleted: false,
            electionLevel: level as any,
            ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Solo admins ven todos
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
