import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [AUTO-SAVE DEBUG] Checking auto-save status...');
    
    // Buscar escrutinios legislativos recientes con papeletas
    const recentEscrutinios = await prisma.escrutinio.findMany({
      where: {
        electionLevel: 'LEGISLATIVE',
        status: { in: ['COMPLETED', 'CLOSED'] }
      },
      include: {
        papeletas: {
          orderBy: { createdAt: 'desc' },
          take: 10 // Solo las 10 más recientes
        },
        mesa: {
          select: {
            number: true,
            location: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    const analysis = recentEscrutinios.map(escrutinio => {
      const totalPapeletas = escrutinio.papeletas.length;
      const closedPapeletas = escrutinio.papeletas.filter(p => p.status === 'CLOSED').length;
      const openPapeletas = escrutinio.papeletas.filter(p => p.status === 'OPEN').length;
      
      // Analizar votesBuffer de cada papeleta
      const papeletasAnalysis = escrutinio.papeletas.map(papeleta => {
        const votesBuffer = Array.isArray(papeleta.votesBuffer) ? papeleta.votesBuffer : [];
        const hasVotes = votesBuffer.length > 0;
        
        return {
          id: papeleta.id,
          status: papeleta.status,
          votesCount: votesBuffer.length,
          hasVotes,
          createdAt: papeleta.createdAt,
          closedAt: papeleta.closedAt,
          timeOpen: papeleta.closedAt ? 
            new Date(papeleta.closedAt).getTime() - new Date(papeleta.createdAt).getTime() : 
            null
        };
      });

      // Calcular estadísticas
      const papeletasWithVotes = papeletasAnalysis.filter(p => p.hasVotes).length;
      const totalVotes = papeletasAnalysis.reduce((sum, p) => sum + p.votesCount, 0);
      const avgTimeOpen = papeletasAnalysis
        .filter(p => p.timeOpen !== null)
        .reduce((sum, p) => sum + (p.timeOpen || 0), 0) / closedPapeletas;

      return {
        escrutinio: {
          id: escrutinio.id,
          mesaNumber: escrutinio.mesa.number,
          mesaLocation: escrutinio.mesa.location,
          status: escrutinio.status,
          createdAt: escrutinio.createdAt,
          hasActa: !!escrutinio.actaImageUrl
        },
        statistics: {
          totalPapeletas,
          closedPapeletas,
          openPapeletas,
          papeletasWithVotes,
          totalVotes,
          avgTimeOpenMs: Math.round(avgTimeOpen || 0),
          avgTimeOpenSec: Math.round((avgTimeOpen || 0) / 1000)
        },
        papeletas: papeletasAnalysis
      };
    });

    // Análisis general
    const totalEscrutinios = recentEscrutinios.length;
    const totalPapeletas = analysis.reduce((sum, a) => sum + a.statistics.totalPapeletas, 0);
    const totalPapeletasWithVotes = analysis.reduce((sum, a) => sum + a.statistics.papeletasWithVotes, 0);
    const totalVotes = analysis.reduce((sum, a) => sum + a.statistics.totalVotes, 0);
    const successRate = totalPapeletas > 0 ? (totalPapeletasWithVotes / totalPapeletas) * 100 : 0;

    const result = {
      summary: {
        totalEscrutinios,
        totalPapeletas,
        totalPapeletasWithVotes,
        totalVotes,
        successRate: Math.round(successRate * 100) / 100,
        avgVotesPerPapeleta: totalPapeletas > 0 ? Math.round((totalVotes / totalPapeletas) * 100) / 100 : 0
      },
      escrutinios: analysis
    };

    console.log('🔍 [AUTO-SAVE DEBUG] Analysis complete:', result.summary);

    return NextResponse.json({
      success: true,
      message: 'Análisis de auto-save completado',
      data: result
    });

  } catch (error) {
    console.error('🔍 [AUTO-SAVE DEBUG] Error in auto-save analysis:', error);
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
