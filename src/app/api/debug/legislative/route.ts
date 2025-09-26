import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // Obtener escrutinios legislativos recientes
    const legislativeEscrutinios = await prisma.escrutinio.findMany({
      where: {
        electionLevel: 'LEGISLATIVE',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
        }
      },
      include: {
        papeletas: {
          select: {
            id: true,
            status: true,
            votesBuffer: true,
            createdAt: true,
            closedAt: true
          }
        },
        mesa: {
          select: {
            number: true,
            location: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    // Procesar cada escrutinio
    const escrutiniosDebug = legislativeEscrutinios.map(escrutinio => {
      // Analizar papeletas
      const papeletasAnalysis = escrutinio.papeletas.map(papeleta => {
        const votesBufferAnalysis = {
          exists: !!papeleta.votesBuffer,
          isArray: Array.isArray(papeleta.votesBuffer),
          length: Array.isArray(papeleta.votesBuffer) ? papeleta.votesBuffer.length : 0,
          sample: Array.isArray(papeleta.votesBuffer) ? papeleta.votesBuffer.slice(0, 3) : null,
          type: typeof papeleta.votesBuffer
        };

        // Calcular votos por partido en esta papeleta
        const partyVotes: Record<string, number> = {};
        if (Array.isArray(papeleta.votesBuffer)) {
          papeleta.votesBuffer.forEach((vote: any) => {
            if (vote.partyId && vote.casillaNumber) {
              const key = `${vote.partyId}_${vote.casillaNumber}`;
              partyVotes[key] = (partyVotes[key] || 0) + 1;
            }
          });
        }

        return {
          id: papeleta.id,
          status: papeleta.status,
          createdAt: papeleta.createdAt,
          closedAt: papeleta.closedAt,
          votesBufferAnalysis,
          partyVotes,
          totalVotesInPapeleta: Object.values(partyVotes).reduce((sum, count) => sum + count, 0)
        };
      });

      // Calcular votos totales del escrutinio
      let totalVotes = 0;
      const allPartyVotes: Record<string, number> = {};
      
      papeletasAnalysis.forEach(papeleta => {
        totalVotes += papeleta.totalVotesInPapeleta;
        Object.entries(papeleta.partyVotes).forEach(([key, count]) => {
          allPartyVotes[key] = (allPartyVotes[key] || 0) + count;
        });
      });

      // Verificar si hay acta
      const hasActa = !!escrutinio.actaImageUrl;
      const actaType = escrutinio.actaImageUrl?.startsWith('data:') ? 'base64' : 'url';

      return {
        id: escrutinio.id,
        mesaNumber: escrutinio.mesa.number,
        mesaLocation: escrutinio.mesa.location,
        status: escrutinio.status,
        createdAt: escrutinio.createdAt,
        completedAt: escrutinio.completedAt,
        hasActa,
        actaType,
        actaImageUrl: escrutinio.actaImageUrl ? 'Presente' : 'Ausente',
        papeletas: papeletasAnalysis,
        totalPapeletas: escrutinio.papeletas.length,
        closedPapeletas: escrutinio.papeletas.filter(p => p.status === 'CLOSED').length,
        openPapeletas: escrutinio.papeletas.filter(p => p.status === 'OPEN').length,
        totalVotes,
        allPartyVotes,
        summary: {
          hasVotes: totalVotes > 0,
          hasActa: hasActa,
          isCompleted: escrutinio.status === 'COMPLETED',
          allPapeletasClosed: escrutinio.papeletas.every(p => p.status === 'CLOSED')
        }
      };
    });

    // Resumen general
    const summary = {
      totalEscrutinios: legislativeEscrutinios.length,
      escrutiniosWithVotes: escrutiniosDebug.filter(e => e.totalVotes > 0).length,
      escrutiniosWithZeroVotes: escrutiniosDebug.filter(e => e.totalVotes === 0).length,
      escrutiniosWithActa: escrutiniosDebug.filter(e => e.hasActa).length,
      escrutiniosWithoutActa: escrutiniosDebug.filter(e => !e.hasActa).length,
      completedEscrutinios: escrutiniosDebug.filter(e => e.status === 'COMPLETED').length,
      closedEscrutinios: escrutiniosDebug.filter(e => e.status === 'CLOSED').length
    };

    const debugData = {
      timestamp: new Date().toISOString(),
      summary,
      escrutinios: escrutiniosDebug
    };

    return NextResponse.json({
      success: true,
      data: debugData
    });

  } catch (error) {
    console.error('Error in legislative debug endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
