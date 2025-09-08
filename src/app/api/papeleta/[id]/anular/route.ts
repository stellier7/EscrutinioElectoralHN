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
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
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

    const votesBuffer = papeleta.votesBuffer as any[];

    // Marcar papeleta como anulada (no aplicar votos)
    const updatedPapeleta = await prisma.papeleta.update({
      where: { id: papeletaId },
      data: {
        status: 'ANULADA',
        anuladaAt: new Date(),
        anuladaReason: reason || 'Anulada por usuario',
        updatedAt: new Date()
      }
    });

    // TODO: AuditLogger.log({
    //   event: 'anular_papeleta',
    //   papeletaId,
    //   userId,
    //   reason: reason || 'Anulada por usuario',
    //   votesDiscarded: votesBuffer.length,
    //   timestamp: Date.now()
    // });

    return NextResponse.json({
      success: true,
      data: {
        papeletaId,
        status: 'ANULADA',
        votesDiscarded: votesBuffer.length,
        anuladaAt: updatedPapeleta.anuladaAt,
        reason: updatedPapeleta.anuladaReason
      }
    });

  } catch (error: any) {
    console.error('Error anulando papeleta:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
