import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const level = searchParams.get('level') || 'PRESIDENTIAL';

    // Obtener mesas más recientes completadas
    const recentMesas = await prisma.escrutinio.findMany({
      where: {
        isCompleted: true,
        electionLevel: level as any,
      },
      include: {
        mesa: true,
        election: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: limit,
    });

    const mesasData = recentMesas.map(escrutinio => ({
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.location,
      department: escrutinio.mesa.department,
      completedAt: escrutinio.completedAt,
      electionLevel: escrutinio.electionLevel,
      totalVotes: 0, // Se calculará si es necesario
    }));

    return NextResponse.json({
      success: true,
      data: mesasData,
    });
  } catch (error) {
    console.error('Error fetching recent mesas:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
