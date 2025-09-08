import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { escrutinioId, userId } = body;

    if (!escrutinioId || !userId) {
      return NextResponse.json(
        { success: false, error: 'escrutinioId y userId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el escrutinio existe y es legislativo
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: { election: true }
    });

    if (!escrutinio) {
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    if (escrutinio.electionLevel !== 'LEGISLATIVE') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden crear papeletas para escrutinio legislativo' },
        { status: 400 }
      );
    }

    // Crear nueva papeleta
    const papeleta = await prisma.papeleta.create({
      data: {
        escrutinioId,
        userId,
        status: 'OPEN',
        votesBuffer: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // TODO: AuditLogger.log({
    //   event: 'start_papeleta',
    //   papeletaId: papeleta.id,
    //   escrutinioId,
    //   userId,
    //   timestamp: Date.now()
    // });

    return NextResponse.json({
      success: true,
      data: {
        papeletaId: papeleta.id,
        status: papeleta.status,
        createdAt: papeleta.createdAt
      }
    });

  } catch (error: any) {
    console.error('Error creating papeleta:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
