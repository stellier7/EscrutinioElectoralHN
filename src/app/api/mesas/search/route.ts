import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    const exact = searchParams.get('exact') === 'true'; // New parameter

    if (query.length < 1) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Buscar mesas que coincidan con el query
    const mesas = await prisma.mesa.findMany({
      where: exact ? {
        // Exact match
        number: query,
        isActive: true
      } : {
        // Fuzzy match (existing behavior)
        OR: [
          {
            number: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            location: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            department: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
        isActive: true,
      },
      take: limit,
      orderBy: [
        {
          number: 'asc',
        },
      ],
    });

    const mesasData = mesas.map(mesa => ({
      id: mesa.id,
      number: mesa.number,
      location: mesa.location,
      department: mesa.department,
      displayName: `${mesa.number} - ${mesa.location}`,
    }));

    return NextResponse.json({
      success: true,
      data: mesasData,
    });
  } catch (error) {
    console.error('Error searching mesas:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
