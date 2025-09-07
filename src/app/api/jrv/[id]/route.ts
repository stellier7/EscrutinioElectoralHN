import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de JRV es requerido' },
        { status: 400 }
      );
    }

    // Buscar la JRV por número
    const mesa = await prisma.mesa.findFirst({
      where: {
        number: {
          contains: id,
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
    const department = await prisma.department.findFirst({
      where: {
        name: {
          contains: mesa.department,
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

    // Formatear nombre de la ubicación (capitalizar correctamente)
    const formatLocationName = (name: string) => {
      return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    return NextResponse.json({
      success: true,
      data: {
        jrv: mesa.number.trim(),
        nombre: formatLocationName(mesa.location),
        departamento: department.name,
        diputados: department.diputados,
        municipio: mesa.municipality ? formatLocationName(mesa.municipality) : null,
      }
    });

  } catch (error) {
    console.error('Error fetching JRV info:', error);
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
