import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Buscar la elección activa
    let election = await prisma.election.findFirst({ 
      where: { 
        isActive: true,
        name: { contains: 'Elecciones Generales' }
      }, 
      orderBy: { startDate: 'desc' } 
    });
    
    if (!election) {
      election = await prisma.election.findFirst({ 
        where: { isActive: true }, 
        orderBy: { startDate: 'desc' } 
      });
    }
    
    if (!election) {
      return NextResponse.json({ 
        success: true, 
        data: [],
        debug: { message: 'No active election found' }
      });
    }

    // Obtener candidatos presidenciales
    const candidates = await prisma.candidate.findMany({ 
      where: { 
        electionId: election.id, 
        electionLevel: 'PRESIDENTIAL',
        isActive: true 
      }, 
      orderBy: { number: 'asc' }
    });

    const data = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      party: c.party,
      number: c.number,
      electionLevel: c.electionLevel,
    }));

    return NextResponse.json({ 
      success: true, 
      data,
      debug: {
        electionId: election.id,
        electionName: election.name,
        candidatesCount: candidates.length,
        parties: Array.from(new Set(candidates.map(c => c.party)))
      }
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false, 
      error: e?.message || 'Error cargando candidatos',
      debug: { error: e }
    }, { status: 500 });
  }
}
