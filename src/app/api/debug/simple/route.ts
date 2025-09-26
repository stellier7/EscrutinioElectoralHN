import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Simple debug endpoint called');
    
    // Buscar escrutinios legislativos recientes
    const recentEscrutinios = await prisma.escrutinio.findMany({
      where: {
        electionLevel: 'LEGISLATIVE'
      },
      include: {
        papeletas: {
          orderBy: { createdAt: 'asc' }
        },
        mesa: {
          select: {
            number: true,
            location: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log('🔍 [DEBUG] Found escrutinios:', recentEscrutinios.length);

    const results = recentEscrutinios.map(escrutinio => {
      // Analizar papeletas
      const papeletasAnalysis = escrutinio.papeletas.map(papeleta => {
        const votesBuffer = Array.isArray(papeleta.votesBuffer) ? papeleta.votesBuffer : [];
        const totalVotes = votesBuffer.length;
        
        // Agrupar por partido
        const partyVotes = votesBuffer.reduce((acc: Record<string, number>, vote: any) => {
          if (vote.partyId) {
            acc[vote.partyId] = (acc[vote.partyId] || 0) + 1;
          }
          return acc;
        }, {});

        return {
          id: papeleta.id,
          status: papeleta.status,
          totalVotes,
          partyVotes,
          votesBuffer: votesBuffer.slice(0, 5), // Primeros 5 para debug
          createdAt: papeleta.createdAt,
          closedAt: papeleta.closedAt
        };
      });

      // Calcular totales por partido
      const totalPartyVotes = papeletasAnalysis.reduce((acc: Record<string, number>, papeleta) => {
        Object.entries(papeleta.partyVotes).forEach(([party, votes]) => {
          acc[party] = (acc[party] || 0) + votes;
        });
        return acc;
      }, {});

      const totalVotes = Object.values(totalPartyVotes).reduce((sum, votes) => sum + votes, 0);

      return {
        id: escrutinio.id,
        mesaNumber: escrutinio.mesa.number,
        mesaLocation: escrutinio.mesa.location,
        status: escrutinio.status,
        totalVotes,
        totalPartyVotes,
        hasActa: !!escrutinio.actaImageUrl,
        actaImageUrl: escrutinio.actaImageUrl ? 'Presente' : 'Ausente',
        createdAt: escrutinio.createdAt,
        papeletas: papeletasAnalysis
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Análisis de escrutinios legislativos recientes',
      data: results
    });

  } catch (error) {
    console.error('🔍 [DEBUG] Error in simple debug:', error);
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
