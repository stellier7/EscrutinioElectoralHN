import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Checking departments...');
    
    // Obtener todos los departamentos
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });

    // Obtener algunas mesas para verificar
    const mesas = await prisma.mesa.findMany({
      take: 5,
      orderBy: { number: 'asc' }
    });

    const result = {
      departments: departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        diputados: dept.diputados,
        isActive: dept.isActive
      })),
      sampleMesas: mesas.map(mesa => ({
        number: mesa.number,
        location: mesa.location,
        department: mesa.department,
        municipality: mesa.municipality
      })),
      totalDepartments: departments.length,
      totalMesas: await prisma.mesa.count()
    };

    console.log('🔍 [DEBUG] Departments check complete:', result);

    return NextResponse.json({
      success: true,
      message: 'Análisis de departamentos completado',
      data: result
    });

  } catch (error) {
    console.error('🔍 [DEBUG] Error checking departments:', error);
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
