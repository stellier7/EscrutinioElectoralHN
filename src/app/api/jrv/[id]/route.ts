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

    // Normalizar el número de JRV (1 → 00001, 123 → 00123)
    const normalizeJRVNumber = (input: string): string => {
      // Si es solo números, normalizar a 5 dígitos
      if (/^\d+$/.test(input)) {
        return input.padStart(5, '0');
      }
      return input;
    };

    const normalizedId = normalizeJRVNumber(id);

    // Buscar la JRV por número (tanto normalizado como original)
    const mesa = await prisma.mesa.findFirst({
      where: {
        OR: [
          {
            number: {
              contains: normalizedId,
              mode: 'insensitive'
            }
          },
          {
            number: {
              contains: id,
              mode: 'insensitive'
            }
          }
        ],
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

    // Mapear código de departamento a nombre
    const departmentMapping: { [key: string]: string } = {
      '01-ATLANTIDA': 'Atlántida',
      '02-COLON': 'Colón',
      '03-COMAYAGUA': 'Comayagua',
      '04-COPAN': 'Copán',
      '05-CORTES': 'Cortés',
      '06-CHOLUTECA': 'Choluteca',
      '07-EL PARAISO': 'El Paraíso',
      '08-FRANCISCO MORAZAN': 'Francisco Morazán',
      '09-GRACIAS A DIOS': 'Gracias a Dios',
      '10-INTIBUCA': 'Intibucá',
      '11-ISLAS DE LA BAHIA': 'Islas de la Bahía',
      '12-LA PAZ': 'La Paz',
      '13-LEMPIRA': 'Lempira',
      '14-OCOTEPEQUE': 'Ocotepeque',
      '15-OLANCHO': 'Olancho',
      '16-SANTA BARBARA': 'Santa Bárbara',
      '17-VALLE': 'Valle',
      '18-YORO': 'Yoro'
    };

    const departmentName = departmentMapping[mesa.department] || mesa.department;

    // Buscar información del departamento
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
