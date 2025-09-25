import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const mesaId = params.id;

    // Obtener escrutinios de la mesa específica
    const escrutinios = await prisma.escrutinio.findMany({
      where: {
        mesaId: mesaId,
        isCompleted: true,
      },
      include: {
        votes: {
          include: {
            candidate: true,
          },
        },
        papeletas: true, // Incluir papeletas para votos legislativos
        mesa: true,
        election: true,
      },
    });

    if (escrutinios.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron escrutinios para esta mesa',
      }, { status: 404 });
    }

    // Agrupar por nivel electoral
    const results: Record<string, {
      level: string;
      mesaNumber: string;
      mesaName: string;
      department: string;
      completedAt: string;
      totalVotes: number;
      candidates: Array<{
        name: string;
        party: string;
        votes: number;
        percentage: number;
      }>;
    }> = {};

    escrutinios.forEach(escrutinio => {
      const level = escrutinio.electionLevel;
      
      if (!results[level]) {
        results[level] = {
          level: level,
          mesaNumber: escrutinio.mesa.number,
          mesaName: escrutinio.mesa.location,
          department: escrutinio.mesa.department,
          completedAt: escrutinio.completedAt?.toISOString() || '',
          totalVotes: 0,
          candidates: [],
        };
      }

      // Procesar votos según el nivel electoral
      if (level === 'PRESIDENTIAL') {
        // Procesar votos presidenciales (candidates)
        const candidateVotes: Record<string, { name: string; party: string; votes: number }> = {};
        
        escrutinio.votes.forEach(vote => {
          const candidateId = vote.candidate.id;
          if (!candidateVotes[candidateId]) {
            candidateVotes[candidateId] = {
              name: vote.candidate.name,
              party: vote.candidate.party,
              votes: 0,
            };
          }
          candidateVotes[candidateId].votes += vote.count;
        });

        const totalVotes = Object.values(candidateVotes).reduce((sum, candidate) => sum + candidate.votes, 0);
        
        results[level].totalVotes = totalVotes;
        results[level].candidates = Object.values(candidateVotes)
          .map(candidate => ({
            ...candidate,
            percentage: totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0,
          }))
          .sort((a, b) => b.votes - a.votes);
      } else if (level === 'LEGISLATIVE') {
        // Procesar votos legislativos (parties from papeletas)
        const partyVotes: Record<string, { name: string; party: string; votes: number }> = {};
        let totalVotes = 0;
        
        escrutinio.papeletas.forEach(papeleta => {
          if (papeleta.votesBuffer && Array.isArray(papeleta.votesBuffer)) {
            papeleta.votesBuffer.forEach((vote: any) => {
              if (vote.partyId && vote.casillaNumber) {
                const partyKey = `${vote.partyId}_${vote.casillaNumber}`;
                if (!partyVotes[partyKey]) {
                  partyVotes[partyKey] = {
                    name: `Casilla ${vote.casillaNumber}`,
                    party: vote.partyId,
                    votes: 0,
                  };
                }
                partyVotes[partyKey].votes += 1;
                totalVotes += 1;
              }
            });
          }
        });
        
        results[level].totalVotes = totalVotes;
        results[level].candidates = Object.values(partyVotes)
          .map(party => ({
            ...party,
            percentage: totalVotes > 0 ? (party.votes / totalVotes) * 100 : 0,
          }))
          .sort((a, b) => b.votes - a.votes);
      }
    });

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error fetching mesa votes:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
