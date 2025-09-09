import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Obtener estadísticas generales
    const totalMesas = await prisma.mesa.count({
      where: { isActive: true },
    });

    const completedEscrutinios = await prisma.escrutinio.count({
      where: { isCompleted: true },
    });

    const pendingEscrutinios = await prisma.escrutinio.count({
      where: { isCompleted: false },
    });

    // Obtener escrutinios recientes
    const recentEscrutinios = await prisma.escrutinio.findMany({
      where: {
        isCompleted: true,
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
          },
        });

        const pending = await prisma.escrutinio.count({
          where: {
            isCompleted: false,
            electionLevel: level as any,
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
