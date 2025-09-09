import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'PRESIDENTIAL';

    // Obtener todas las mesas agrupadas por ubicación
    const mesasByLocation = await prisma.mesa.groupBy({
      by: ['location', 'department'],
      where: {
        isActive: true,
      },
      _count: {
        id: true,
      },
    });

    // Obtener escrutinios completados por ubicación
    const completedEscrutinios = await prisma.escrutinio.findMany({
      where: {
        isCompleted: true,
        electionLevel: level as any,
      },
      include: {
        mesa: true,
      },
    });

    // Crear mapa de completados por ubicación
    const completedByLocation: Record<string, number> = {};
    completedEscrutinios.forEach(escrutinio => {
      const key = `${escrutinio.mesa.location}-${escrutinio.mesa.department}`;
      completedByLocation[key] = (completedByLocation[key] || 0) + 1;
    });

    // Procesar datos
    const locationData = mesasByLocation.map(location => {
      const key = `${location.location}-${location.department}`;
      const total = location._count.id;
      const completed = completedByLocation[key] || 0;
      const pending = total - completed;
      const completionPercentage = total > 0 ? (completed / total) * 100 : 0;

      return {
        location: location.location,
        department: location.department,
        total,
        completed,
        pending,
        completionPercentage,
        status: completed === total ? 'completed' : completed > 0 ? 'partial' : 'pending',
      };
    });

    // Ordenar por porcentaje de completado descendente
    locationData.sort((a, b) => b.completionPercentage - a.completionPercentage);

    return NextResponse.json({
      success: true,
      data: locationData,
    });
  } catch (error) {
    console.error('Error fetching mesas by location:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
