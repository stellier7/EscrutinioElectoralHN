import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatNameShort } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface ActivityEvent {
  id: string;
  type: 'volunteer_registration' | 'legislative_scrutiny';
  userName: string;
  timestamp: string;
  message: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Consultar últimos 5 registros de voluntarios aprobados
    const recentVolunteers = await prisma.user.findMany({
      where: {
        role: 'VOLUNTEER',
        status: 'APPROVED',
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    // Consultar últimos 5 escrutinios legislativos
    const recentLegislativeScrutinies = await prisma.escrutinio.findMany({
      where: {
        electionLevel: 'LEGISLATIVE',
      },
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    // Transformar a eventos unificados
    const events: ActivityEvent[] = [];

    // Agregar registros de voluntarios
    for (const volunteer of recentVolunteers) {
      const formattedName = formatNameShort(volunteer.name);
      // Solo agregar si el nombre formateado no está vacío
      if (formattedName) {
        events.push({
          id: `volunteer-${volunteer.id}`,
          type: 'volunteer_registration',
          userName: formattedName,
          timestamp: volunteer.createdAt.toISOString(),
          message: `${formattedName} acaba de registrarse como voluntario`,
        });
      }
    }

    // Agregar escrutinios legislativos
    for (const scrutiny of recentLegislativeScrutinies) {
      const formattedName = formatNameShort(scrutiny.user.name);
      // Solo agregar si el nombre formateado no está vacío
      if (formattedName) {
        events.push({
          id: `scrutiny-${scrutiny.id}`,
          type: 'legislative_scrutiny',
          userName: formattedName,
          timestamp: scrutiny.createdAt.toISOString(),
          message: `${formattedName} hizo un escrutinio legislativo`,
        });
      }
    }

    // Ordenar por timestamp descendente y limitar a 5 eventos más recientes
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const topEvents = events.slice(0, 5);

    return NextResponse.json({
      success: true,
      events: topEvents,
    });
  } catch (error) {
    console.error('Error fetching activity glimpse:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener actividad reciente',
        events: [],
      },
      { status: 500 }
    );
  }
}

