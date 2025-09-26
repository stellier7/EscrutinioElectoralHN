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

    // 1. Verificar autenticación
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // 2. Verificar escrutinios legislativos recientes
    const recentLegislativeEscrutinios = await prisma.escrutinio.findMany({
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
      take: 5
    });

    // 3. Procesar datos de papeletas
    const escrutiniosWithVotes = recentLegislativeEscrutinios.map(escrutinio => {
      const papeletasDebug = escrutinio.papeletas.map(papeleta => ({
        id: papeleta.id,
        status: papeleta.status,
        votesBufferType: typeof papeleta.votesBuffer,
        votesBufferIsArray: Array.isArray(papeleta.votesBuffer),
        votesBufferLength: Array.isArray(papeleta.votesBuffer) ? papeleta.votesBuffer.length : 0,
        votesBufferSample: Array.isArray(papeleta.votesBuffer) ? papeleta.votesBuffer.slice(0, 2) : papeleta.votesBuffer,
        createdAt: papeleta.createdAt,
        closedAt: papeleta.closedAt
      }));

      // Calcular votos totales
      let totalVotes = 0;
      const partyVotesMap = new Map();
      
      escrutinio.papeletas.forEach(papeleta => {
        if (papeleta.votesBuffer && Array.isArray(papeleta.votesBuffer)) {
          papeleta.votesBuffer.forEach((vote: any) => {
            if (vote.partyId && vote.casillaNumber) {
              totalVotes += 1;
              const partyKey = vote.partyId;
              if (!partyVotesMap.has(partyKey)) {
                partyVotesMap.set(partyKey, 0);
              }
              partyVotesMap.set(partyKey, partyVotesMap.get(partyKey) + 1);
            }
          });
        }
      });

      return {
        id: escrutinio.id,
        mesaNumber: escrutinio.mesa.number,
        mesaLocation: escrutinio.mesa.location,
        status: escrutinio.status,
        createdAt: escrutinio.createdAt,
        completedAt: escrutinio.completedAt,
        papeletas: papeletasDebug,
        totalPapeletas: escrutinio.papeletas.length,
        closedPapeletas: escrutinio.papeletas.filter(p => p.status === 'CLOSED').length,
        totalVotes: totalVotes,
        partyVotes: Object.fromEntries(partyVotesMap)
      };
    });

    // 4. Verificar configuración de base de datos
    const dbStatus = await prisma.$queryRaw`SELECT 1 as test`;
    const userCount = await prisma.user.count();
    const escrutinioCount = await prisma.escrutinio.count();
    const papeletaCount = await prisma.papeleta.count();

    const debugData = {
      timestamp: new Date().toISOString(),
      authentication: {
        user: user,
        tokenValid: !!payload,
        tokenExpired: AuthUtils.isTokenExpired(token)
      },
      database: {
        connected: !!dbStatus,
        userCount,
        escrutinioCount,
        papeletaCount
      },
      recentLegislativeEscrutinios: escrutiniosWithVotes,
      summary: {
        totalRecentEscrutinios: recentLegislativeEscrutinios.length,
        escrutiniosWithVotes: escrutiniosWithVotes.filter(e => e.totalVotes > 0).length,
        escrutiniosWithZeroVotes: escrutiniosWithVotes.filter(e => e.totalVotes === 0).length
      }
    };

    return NextResponse.json({
      success: true,
      data: debugData
    });

  } catch (error) {
    console.error('Error in critical debug endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
