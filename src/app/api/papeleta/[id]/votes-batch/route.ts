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
    const { votes } = body;

    if (!votes || !Array.isArray(votes)) {
      return NextResponse.json(
        { success: false, error: 'votes array es requerido' },
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

    // Validar que todos los votos tienen la estructura correcta
    const validVotes = votes.filter((vote: any) => 
      vote.partyId && 
      vote.casillaNumber && 
      typeof vote.timestamp === 'number'
    );

    if (validVotes.length !== votes.length) {
      return NextResponse.json(
        { success: false, error: 'Algunos votos tienen estructura inválida' },
        { status: 400 }
      );
    }

    // Actualizar el buffer de votos de la papeleta
    const updatedPapeleta = await prisma.papeleta.update({
      where: { id: papeletaId },
      data: {
        votesBuffer: validVotes,
        updatedAt: new Date()
      }
    });

    console.log(`✅ [BATCH-SAVE] Guardados ${validVotes.length} votos en papeleta ${papeletaId}`);

    return NextResponse.json({
      success: true,
      data: {
        papeletaId,
        votesCount: validVotes.length,
        lastVote: validVotes[validVotes.length - 1] || null
      }
    });

  } catch (error: any) {
    console.error('Error saving votes batch:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
