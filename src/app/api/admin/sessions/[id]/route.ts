import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/sessions/[id] - Obtener detalles de una sesión específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    
    const payload = AuthUtils.verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const sessionId = params.id;

    // Obtener la sesión con estadísticas detalladas
    const session = await prisma.escrutinioSession.findUnique({
      where: { id: sessionId },
      include: {
        closedByUser: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    // Obtener escrutinios de la sesión con detalles
    const escrutinios = await prisma.escrutinio.findMany({
      where: { sessionId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        },
        mesa: {
          select: {
            number: true,
            location: true,
            department: true,
            municipality: true
          }
        },
        votes: {
          include: {
            candidate: {
              select: {
                name: true,
                party: true,
                number: true
              }
            }
          }
        },
        papeletas: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            closedAt: true
          }
        },
        _count: {
          select: {
            votes: true,
            papeletas: true,
            corrections: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calcular estadísticas agregadas
    const totalVotes = escrutinios.reduce((sum, escrutinio) => {
      return sum + escrutinio.votes.reduce((voteSum, vote) => voteSum + vote.count, 0);
    }, 0);

    const uniqueUsers = new Set(escrutinios.map(e => e.userId)).size;
    const completedEscrutinios = escrutinios.filter(e => e.isCompleted).length;
    const totalPapeletas = escrutinios.reduce((sum, e) => sum + e._count.papeletas, 0);
    const totalCorrections = escrutinios.reduce((sum, e) => sum + e._count.corrections, 0);

    // Agrupar votos por candidato para resultados
    const candidateResults: Record<string, { candidate: any; totalVotes: number }> = {};
    escrutinios.forEach(escrutinio => {
      escrutinio.votes.forEach(vote => {
        const candidateId = vote.candidateId;
        if (!candidateResults[candidateId]) {
          candidateResults[candidateId] = {
            candidate: vote.candidate,
            totalVotes: 0
          };
        }
        candidateResults[candidateId].totalVotes += vote.count;
      });
    });

    const results = Object.values(candidateResults).sort((a, b) => b.totalVotes - a.totalVotes);

    return NextResponse.json({
      success: true,
      data: {
        session,
        escrutinios,
        stats: {
          totalEscrutinios: escrutinios.length,
          completedEscrutinios,
          totalVotes,
          uniqueUsers,
          totalPapeletas,
          totalCorrections
        },
        results
      }
    });

  } catch (error: any) {
    console.error('Error fetching session details:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
