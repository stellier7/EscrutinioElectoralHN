import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const papeletaId = params.id;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la papeleta existe y está abierta
    const papeleta = await prisma.papeleta.findUnique({
      where: { id: papeletaId },
      include: { escrutinio: true }
    });

    if (!papeleta) {
      return NextResponse.json(
        { success: false, error: 'Papeleta no encontrada' },
        { status: 404 }
      );
    }

    if (papeleta.status !== 'OPEN') {
      return NextResponse.json(
        { success: false, error: 'La papeleta no está abierta' },
        { status: 400 }
      );
    }

    const votesBuffer = papeleta.votesBuffer as any[];

    // Aplicar votos del buffer a los contadores globales
    await prisma.$transaction(async (tx) => {
      for (const vote of votesBuffer) {
        // Buscar o crear candidato
        let candidate = await tx.candidate.findFirst({
          where: {
            electionId: papeleta.escrutinio.electionId,
            number: vote.casillaNumber,
            electionLevel: 'LEGISLATIVE'
          }
        });

        if (!candidate) {
          // Crear candidato placeholder si no existe
          candidate = await tx.candidate.create({
            data: {
              name: `Diputado ${vote.casillaNumber}`,
              party: vote.partyId,
              number: vote.casillaNumber,
              electionId: papeleta.escrutinio.electionId,
              electionLevel: 'LEGISLATIVE',
              isActive: true
            }
          });
        }

        // Verificar si ya existe un voto para este candidato en este escrutinio
        const existingVote = await tx.vote.findUnique({
          where: {
            escrutinioId_candidateId: {
              escrutinioId: papeleta.escrutinioId,
              candidateId: candidate.id
            }
          }
        });

        if (existingVote) {
          // Incrementar voto existente
          await tx.vote.update({
            where: { id: existingVote.id },
            data: { count: existingVote.count + 1 }
          });
        } else {
          // Crear nuevo voto
          await tx.vote.create({
            data: {
              escrutinioId: papeleta.escrutinioId,
              candidateId: candidate.id,
              count: 1
            }
          });
        }
      }

      // Marcar papeleta como cerrada
      await tx.papeleta.update({
        where: { id: papeletaId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          updatedAt: new Date()
        }
      });
    });

    // TODO: AuditLogger.log({
    //   event: 'close_papeleta',
    //   papeletaId,
    //   userId,
    //   voteCount: votesBuffer.length,
    //   timestamp: Date.now()
    // });

    return NextResponse.json({
      success: true,
      data: {
        papeletaId,
        status: 'CLOSED',
        votesApplied: votesBuffer.length,
        closedAt: new Date()
      }
    });

  } catch (error: any) {
    console.error('Error closing papeleta:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
