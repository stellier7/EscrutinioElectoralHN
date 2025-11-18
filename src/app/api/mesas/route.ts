import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jrvNumber = searchParams.get('jrv');
    const department = searchParams.get('department');
    const limit = parseInt(searchParams.get('limit') || '100');

    let whereClause: any = { isActive: true };

    // Filtrar por número de JRV específico
    if (jrvNumber) {
      whereClause.number = {
        contains: jrvNumber,
        mode: 'insensitive'
      };
    }

    // Filtrar por departamento
    if (department) {
      whereClause.department = {
        contains: department,
        mode: 'insensitive'
      };
    }

    const mesas = await prisma.mesa.findMany({
      where: whereClause,
      select: {
        id: true,
        number: true,
        location: true,
        address: true,
        department: true,
        municipality: true,
        area: true,
        cargaElectoral: true,
        latitude: true,
        longitude: true,
      },
      orderBy: [
        { department: 'asc' },
        { municipality: 'asc' },
        { number: 'asc' }
      ],
      take: limit
    });

    return NextResponse.json({
      success: true,
      data: mesas,
      count: mesas.length
    });

  } catch (error) {
    console.error('Error fetching mesas:', error);
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

// Endpoint para obtener una JRV específica por número
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jrvNumber } = body;

    if (!jrvNumber) {
      return NextResponse.json(
        { success: false, error: 'Número de JRV es requerido' },
        { status: 400 }
      );
    }

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
        address: true,
        department: true,
        municipality: true,
        area: true,
        cargaElectoral: true,
        latitude: true,
        longitude: true,
      }
    });

    if (!mesa) {
      return NextResponse.json(
        { success: false, error: 'JRV no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mesa
    });

  } catch (error) {
    console.error('Error fetching mesa:', error);
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