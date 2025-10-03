import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { candidateIds } = await request.json();
    
    if (!Array.isArray(candidateIds)) {
      return NextResponse.json({ success: false, error: 'candidateIds debe ser un array' }, { status: 400 });
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        id: {
          in: candidateIds
        }
      },
      select: {
        id: true,
        name: true,
        party: true,
        number: true,
        electionLevel: true
      }
    });

    // Crear un mapa de ID -> información del candidato
    const candidateMap = candidates.reduce((acc, candidate) => {
      acc[candidate.id] = {
        name: candidate.name,
        party: candidate.party,
        number: candidate.number,
        electionLevel: candidate.electionLevel
      };
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({ 
      success: true, 
      data: candidateMap 
    });

  } catch (error) {
    console.error('Error looking up candidates:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
