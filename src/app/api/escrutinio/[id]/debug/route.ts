import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const escrutinioId = params.id;

    // Obtener el escrutinio con todos los datos relacionados
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: {
        mesa: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        votes: {
          include: {
            candidate: true
          }
        },
        papeletas: true, // Incluir papeletas para votos legislativos
      }
    });

    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }

    // Procesar papeletas para diagnóstico
    const papeletasDebug = escrutinio.papeletas.map(papeleta => ({
      id: papeleta.id,
      status: papeleta.status,
      createdAt: papeleta.createdAt,
      closedAt: papeleta.closedAt,
      votesBufferType: typeof papeleta.votesBuffer,
      votesBufferIsArray: Array.isArray(papeleta.votesBuffer),
      votesBufferLength: Array.isArray(papeleta.votesBuffer) ? papeleta.votesBuffer.length : 0,
      votesBufferSample: Array.isArray(papeleta.votesBuffer) ? papeleta.votesBuffer.slice(0, 3) : papeleta.votesBuffer,
      votesBufferFull: papeleta.votesBuffer
    }));

    // Procesar votos presidenciales si existen
    const votesDebug = escrutinio.votes.map(vote => ({
      id: vote.id,
      candidateId: vote.candidateId,
      candidateName: vote.candidate.name,
      count: vote.count
    }));

    const debugData = {
      escrutinio: {
        id: escrutinio.id,
        status: escrutinio.status,
        electionLevel: escrutinio.electionLevel,
        mesaNumber: escrutinio.mesa.number,
        createdAt: escrutinio.createdAt,
        completedAt: escrutinio.completedAt,
        actaImageUrl: escrutinio.actaImageUrl
      },
      papeletas: papeletasDebug,
      votes: votesDebug,
      summary: {
        totalPapeletas: escrutinio.papeletas.length,
        closedPapeletas: escrutinio.papeletas.filter(p => p.status === 'CLOSED').length,
        openPapeletas: escrutinio.papeletas.filter(p => p.status === 'OPEN').length,
        totalVotesPresidencial: escrutinio.votes.reduce((sum, v) => sum + v.count, 0),
        totalVotesBuffer: escrutinio.papeletas.reduce((sum, p) => {
          return sum + (Array.isArray(p.votesBuffer) ? p.votesBuffer.length : 0);
        }, 0)
      }
    };

    return NextResponse.json({
      success: true,
      data: debugData
    });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
