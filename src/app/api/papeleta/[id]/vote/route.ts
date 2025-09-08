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
    const { partyId, casillaNumber, userId } = body;

    if (!partyId || !casillaNumber || !userId) {
      return NextResponse.json(
        { success: false, error: 'partyId, casillaNumber y userId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la papeleta existe y está abierta
    const papeleta = await prisma.papeleta.findUnique({
      where: { id: papeletaId }
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

    // Crear nuevo voto en buffer
    const newVote = {
      partyId,
      casillaNumber,
      timestamp: Date.now()
    };

    // Actualizar buffer de votos
    const updatedBuffer = [...(papeleta.votesBuffer as any[]), newVote];

    const updatedPapeleta = await prisma.papeleta.update({
      where: { id: papeletaId },
      data: {
        votesBuffer: updatedBuffer,
        updatedAt: new Date()
      }
    });

    // TODO: AuditLogger.log({
    //   event: 'vote_buffered',
    //   papeletaId,
    //   partyId,
    //   casillaNumber,
    //   userId,
    //   timestamp: Date.now()
    // });

    return NextResponse.json({
      success: true,
      data: {
        papeletaId,
        voteCount: updatedBuffer.length,
        lastVote: newVote
      }
    });

  } catch (error: any) {
    console.error('Error adding vote to papeleta:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
