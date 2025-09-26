import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const escrutinioId = params.id;
    
    console.log('🔍 [DEBUG] Verificando estado del store legislativo para escrutinio:', escrutinioId);
    
    // Obtener el escrutinio
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: {
        votes: {
          include: {
            candidate: true
          }
        }
      }
    });
    
    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }
    
    // Simular lo que debería estar en el store legislativo
    const parties = ['pdc', 'libre', 'pinu-sd', 'liberal', 'nacional'];
    const diputadosPerParty = 8;
    
    const storeState = {
      counts: {} as Record<string, number>,
      totalVotes: 0
    };
    
    // Procesar votos de la base de datos
    escrutinio.votes.forEach((vote) => {
      if (vote.candidate && vote.candidate.electionLevel === 'LEGISLATIVE') {
        const key = `${vote.candidate.party}_${vote.candidate.number}`;
        storeState.counts[key] = vote.count;
        storeState.totalVotes += vote.count;
      }
    });
    
    // Crear estructura de partidos
    const partiesData = parties.map((partyId, partyIndex) => {
      const partyVotes = [];
      let partyTotal = 0;
      
      for (let casilla = 1; casilla <= diputadosPerParty; casilla++) {
        const casillaNumber = partyIndex * diputadosPerParty + casilla;
        const key = `${partyId}_${casillaNumber}`;
        const votes = storeState.counts[key] || 0;
        
        partyVotes.push({
          casilla: casillaNumber,
          votes: votes,
          key: key
        });
        
        partyTotal += votes;
      }
      
      return {
        partyId,
        total: partyTotal,
        casillas: partyVotes
      };
    });
    
    console.log('🔍 [DEBUG] Estado del store simulado:', {
      totalVotes: storeState.totalVotes,
      parties: partiesData
    });
    
    return NextResponse.json({
      success: true,
      data: {
        escrutinio: {
          id: escrutinio.id,
          electionLevel: escrutinio.electionLevel,
          status: escrutinio.status
        },
        storeState: {
          counts: storeState.counts,
          totalVotes: storeState.totalVotes
        },
        parties: partiesData,
        rawVotes: escrutinio.votes.map(v => ({
          id: v.id,
          candidateId: v.candidateId,
          count: v.count,
          candidate: v.candidate ? {
            id: v.candidate.id,
            name: v.candidate.name,
            party: v.candidate.party,
            number: v.candidate.number,
            electionLevel: v.candidate.electionLevel
          } : null
        }))
      }
    });
    
  } catch (error: any) {
    console.error('❌ [DEBUG] Error verificando store legislativo:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    );
  }
}
