import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.length < 1) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Normalizar el número de JRV (1 → 00001, 123 → 00123)
    const normalizeJRVNumber = (input: string): string => {
      // Si es solo números, normalizar a 5 dígitos
      if (/^\d+$/.test(input)) {
        return input.padStart(5, '0');
      }
      return input;
    };

    const normalizedQuery = normalizeJRVNumber(query);

    // Buscar JRVs que coincidan con la consulta
    const mesas = await prisma.mesa.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              {
                number: {
                  contains: normalizedQuery,
                  mode: 'insensitive'
                }
              },
              {
                number: {
                  contains: query,
                  mode: 'insensitive'
                }
              },
              {
                location: {
                  contains: query,
                  mode: 'insensitive'
                }
              }
            ]
          }
        ]
      },
      select: {
        number: true,
        location: true,
        department: true,
      },
      orderBy: [
        { number: 'asc' }
      ],
      take: limit
    });

    // Formatear resultados para autocompletado
    const results = mesas.map(mesa => ({
      value: mesa.number.trim(),
      label: `${mesa.number.trim()} – ${formatLocationName(mesa.location)}`,
      location: formatLocationName(mesa.location),
      department: mesa.department
    }));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('Error searching JRVs:', error);
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

// Función para formatear nombres de ubicación
function formatLocationName(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
