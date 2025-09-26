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
    console.log('🔍 [DEBUG] Mesa department:', mesa.department);
    console.log('🔍 [DEBUG] Extracted department name:', departmentName);
    
    // Buscar departamento - mapeo directo para casos conocidos
    let department;
    
    // Mapeo directo para casos específicos
    const departmentMap: { [key: string]: string } = {
      'ATLANTIDA': 'Atlántida',
      'CORTES': 'Cortés',
      'FRANCISCO MORAZAN': 'Francisco Morazán',
      'GRACIAS A DIOS': 'Gracias a Dios',
      'ISLAS DE LA BAHIA': 'Islas de la Bahía',
      'LA PAZ': 'La Paz',
      'SANTA BARBARA': 'Santa Bárbara'
    };
    
    const searchName = departmentMap[departmentName.toUpperCase()] || departmentName;
    
    department = await prisma.department.findFirst({
      where: {
        name: {
          contains: searchName,
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
        fullName: 'Demócrata Cristiano',
        color: '#16a34a'
      },
      {
        id: 'libre',
        name: 'LIBRE',
        fullName: 'LIBRE',
        color: '#dc2626'
      },
      {
        id: 'pinu-sd',
        name: 'PINU',
        fullName: 'PINU',
        color: '#7c3aed'
      },
      {
        id: 'liberal',
        name: 'Partido Liberal',
        fullName: 'Partido Liberal',
        color: '#ef4444'
      },
      {
        id: 'nacional',
        name: 'Partido Nacional',
        fullName: 'Partido Nacional',
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
        parties: parties.map((party, index) => {
          const startSlot = index * department.diputados + 1;
          const endSlot = (index + 1) * department.diputados;
          const casillas = Array.from({ length: department.diputados }, (_, i) => startSlot + i);
          
          return {
            ...party,
            slots: department.diputados, // Número de casillas por partido
            slotRange: `${startSlot}-${endSlot}`, // Rango de casillas consecutivo
            casillas: casillas // Array de números de casillas
          };
        })
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
