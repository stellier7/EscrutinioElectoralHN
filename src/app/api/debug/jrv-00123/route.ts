import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Checking JRV 00123 escrutinios...');
    
    // Buscar la mesa 00123
    const mesa = await prisma.mesa.findFirst({
      where: {
        OR: [
          { number: '00123' },
          { number: '123' }
        ]
      }
    });

    if (!mesa) {
      return NextResponse.json({
        success: false,
        error: 'JRV 00123 no encontrada'
      });
    }

    console.log('🔍 [DEBUG] Mesa encontrada:', mesa.id, mesa.number, mesa.location);

    // Buscar todos los escrutinios para esta JRV
    const escrutinios = await prisma.escrutinio.findMany({
      where: {
        mesaId: mesa.id
      },
      include: {
        papeletas: {
          orderBy: { createdAt: 'asc' }
        },
        votes: {
          include: {
            candidate: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('🔍 [DEBUG] Escrutinios encontrados:', escrutinios.length);

    if (escrutinios.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No se encontraron escrutinios para JRV 00123',
        data: {
          mesa: {
            id: mesa.id,
            number: mesa.number,
            location: mesa.location
          },
          escrutinios: []
        }
      });
    }

    // Analizar el escrutinio más reciente
    const latestEscrutinio = escrutinios[0];
    console.log('🔍 [DEBUG] Analizando escrutinio más reciente:', latestEscrutinio.id);

    // Analizar papeletas
    const papeletasAnalysis = latestEscrutinio.papeletas.map(papeleta => {
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
        votesBuffer: votesBuffer.slice(0, 10), // Primeros 10 para debug
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

    // Verificar acta
    const hasActa = !!latestEscrutinio.actaImageUrl;
    const actaType = latestEscrutinio.actaImageUrl?.startsWith('data:') ? 'dataUrl' : 's3';

    const result = {
      mesa: {
        id: mesa.id,
        number: mesa.number,
        location: mesa.location
      },
      escrutinio: {
        id: latestEscrutinio.id,
        electionLevel: latestEscrutinio.electionLevel,
        status: latestEscrutinio.status,
        totalVotes,
        totalPartyVotes,
        hasActa,
        actaType,
        actaImageUrl: latestEscrutinio.actaImageUrl ? 'Presente' : 'Ausente',
        createdAt: latestEscrutinio.createdAt,
        updatedAt: latestEscrutinio.updatedAt
      },
      papeletas: papeletasAnalysis,
      summary: {
        totalPapeletas: latestEscrutinio.papeletas.length,
        closedPapeletas: latestEscrutinio.papeletas.filter(p => p.status === 'CLOSED').length,
        totalVotes,
        partiesWithVotes: Object.keys(totalPartyVotes).length,
        hasActa
      }
    };

    console.log('🔍 [DEBUG] JRV 00123 analysis complete:', result.summary);

    return NextResponse.json({
      success: true,
      message: 'Análisis de JRV 00123 completado',
      data: result
    });

  } catch (error) {
    console.error('🔍 [DEBUG] Error analyzing JRV 00123:', error);
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
