import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentName = searchParams.get('name');
    const includeDiputados = searchParams.get('includeDiputados') === 'true';

    let whereClause: any = { isActive: true };

    // Filtrar por nombre de departamento específico
    if (departmentName) {
      whereClause.name = {
        contains: departmentName,
        mode: 'insensitive'
      };
    }

    const departments = await prisma.department.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        diputados: includeDiputados,
        isActive: true,
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: departments,
      count: departments.length
    });

  } catch (error) {
    console.error('Error fetching departments:', error);
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

// Endpoint para obtener información de diputados por departamento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { departmentName, jrvNumber } = body;

    let department = null;

    // Si se proporciona número de JRV, buscar el departamento asociado
    if (jrvNumber) {
      const mesa = await prisma.mesa.findFirst({
        where: {
          number: {
            contains: jrvNumber,
            mode: 'insensitive'
          },
          isActive: true
        },
        select: {
          department: true
        }
      });

      if (mesa) {
        department = await prisma.department.findFirst({
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
      }
    } 
    // Si se proporciona nombre de departamento directamente
    else if (departmentName) {
      department = await prisma.department.findFirst({
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
    }

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: department
    });

  } catch (error) {
    console.error('Error fetching department info:', error);
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
