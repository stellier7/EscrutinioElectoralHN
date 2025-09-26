import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const mesaId = params.id;

    // Buscar mesa por número
    const mesa = await prisma.mesa.findFirst({
      where: {
        number: mesaId
      }
    });

    if (!mesa) {
      return NextResponse.json({
        success: false,
        error: 'Mesa no encontrada'
      }, { status: 404 });
    }

    // Obtener datos de diputados del departamento
    const department = await prisma.department.findFirst({
      where: {
        name: mesa.department
      }
    });

    const diputados = department?.diputados || 0;

    return NextResponse.json({
      success: true,
      data: {
        id: mesa.id,
        number: mesa.number,
        location: mesa.location,
        department: mesa.department,
        municipality: mesa.municipality,
        diputados: diputados,
        isActive: mesa.isActive,
        createdAt: mesa.createdAt,
        updatedAt: mesa.updatedAt
      }
    });

  } catch (error: any) {
    console.error('Error fetching mesa data:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
