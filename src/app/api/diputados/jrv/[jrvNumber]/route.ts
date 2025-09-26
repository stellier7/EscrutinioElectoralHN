import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { jrvNumber: string } }
) {
  try {
    const { jrvNumber } = params;

    if (!jrvNumber) {
      return NextResponse.json(
        { success: false, error: 'Número de JRV es requerido' },
        { status: 400 }
      );
    }

    // Buscar la JRV y obtener información del departamento
    const mesa = await prisma.mesa.findFirst({
      where: {
        number: {
          contains: jrvNumber,
          mode: 'insensitive'
        },
        isActive: true
      },
      select: {
        id: true,
        number: true,
        location: true,
        department: true,
        municipality: true,
      }
    });

    if (!mesa) {
      return NextResponse.json(
        { success: false, error: 'JRV no encontrada' },
        { status: 404 }
      );
    }

    // Buscar información del departamento
    // Extraer solo el nombre del departamento (remover código numérico)
    const departmentName = mesa.department.replace(/^\d+-/, '').trim();
    
    const department = await prisma.department.findFirst({
      where: {
        name: {
          contains: departmentName,
          mode: 'insensitive'
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        code: true,
        diputados: true,
      }
    });

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'Información del departamento no encontrada' },
        { status: 404 }
      );
    }

    // Configuración de partidos políticos
    const parties = [
      {
        id: 'pdc',
        name: 'Demócrata Cristiano',
        fullName: 'Partido Demócrata Cristiano',
        color: '#16a34a'
      },
      {
        id: 'libre',
        name: 'Libre',
        fullName: 'Partido Libertad y Refundación (LIBRE)',
        color: '#dc2626'
      },
      {
        id: 'pinu-sd',
        name: 'PINU-SD',
        fullName: 'Partido Innovación y Unidad Social Demócrata (PINU-SD)',
        color: '#7c3aed'
      },
      {
        id: 'liberal',
        name: 'Liberal',
        fullName: 'Partido Liberal de Honduras',
        color: '#ef4444'
      },
      {
        id: 'nacional',
        name: 'Nacional',
        fullName: 'Partido Nacional de Honduras',
        color: '#2563eb'
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        jrv: {
          id: mesa.id,
          number: mesa.number,
          location: mesa.location,
          department: mesa.department,
          municipality: mesa.municipality,
        },
        department: {
          id: department.id,
          name: department.name,
          code: department.code,
          diputados: department.diputados,
        },
        parties: parties.map(party => ({
          ...party,
          slots: department.diputados, // Número de casillas por partido
          slotRange: `1-${department.diputados}` // Rango de casillas
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching diputados info for JRV:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
