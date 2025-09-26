import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Legislative flow diagnostic started');
    
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // Buscar el escrutinio legislativo más reciente
    const recentEscrutinio = await prisma.escrutinio.findFirst({
      where: {
        electionLevel: 'LEGISLATIVE',
        status: { in: ['COMPLETED', 'CLOSED'] }
      },
      orderBy: { updatedAt: 'desc' },
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
      }
    });

    if (!recentEscrutinio) {
      return NextResponse.json({
        success: true,
        message: 'No se encontraron escrutinios legislativos recientes',
        data: null
      });
    }

    console.log('🔍 [DEBUG] Found recent legislative escrutinio:', recentEscrutinio.id);

    // Analizar papeletas y votos
    const papeletasAnalysis = recentEscrutinio.papeletas.map(papeleta => {
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
        votesBuffer: votesBuffer.slice(0, 5), // Solo primeros 5 para debug
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
    const hasActa = !!recentEscrutinio.actaImageUrl;
    const actaType = recentEscrutinio.actaImageUrl?.startsWith('data:') ? 'dataUrl' : 's3';

    const result = {
      escrutinio: {
        id: recentEscrutinio.id,
        mesaNumber: recentEscrutinio.mesaNumber,
        mesaLocation: recentEscrutinio.mesa.location,
        status: recentEscrutinio.status,
        totalVotes,
        totalPartyVotes,
        hasActa,
        actaType,
        actaImageUrl: recentEscrutinio.actaImageUrl ? 'Presente' : 'Ausente',
        createdAt: recentEscrutinio.createdAt,
        updatedAt: recentEscrutinio.updatedAt
      },
      papeletas: papeletasAnalysis,
      summary: {
        totalPapeletas: recentEscrutinio.papeletas.length,
        closedPapeletas: recentEscrutinio.papeletas.filter(p => p.status === 'CLOSED').length,
        totalVotes,
        partiesWithVotes: Object.keys(totalPartyVotes).length,
        hasActa
      }
    };

    console.log('🔍 [DEBUG] Legislative flow analysis complete:', result.summary);

    return NextResponse.json({
      success: true,
      message: 'Análisis del flujo legislativo completado',
      data: result
    });

  } catch (error) {
    console.error('🔍 [DEBUG] Error in legislative flow diagnostic:', error);
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
