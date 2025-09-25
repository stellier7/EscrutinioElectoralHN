import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

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

    const papeletaId = params.id;

    // Obtener la papeleta con sus votos
    const papeleta = await prisma.papeleta.findUnique({
      where: { id: papeletaId },
      include: {
        escrutinio: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!papeleta) {
      return NextResponse.json({ success: false, error: 'Papeleta no encontrada' }, { status: 404 });
    }

    // Verificar que el usuario puede acceder a esta papeleta (solo el creador o admin)
    if (papeleta.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado para ver esta papeleta' }, { status: 403 });
    }

    // Obtener los votos de la papeleta
    const votes = await prisma.papeletaVote.findMany({
      where: { papeletaId: papeleta.id },
      orderBy: { createdAt: 'asc' }
    });

    // Convertir votos al formato esperado
    const votesBuffer = votes.map(vote => ({
      partyId: vote.partyId,
      casillaNumber: vote.casillaNumber,
      timestamp: vote.createdAt.getTime()
    }));

    return NextResponse.json({
      success: true,
      data: {
        id: papeleta.id,
        status: papeleta.status,
        votesBuffer,
        createdAt: papeleta.createdAt,
        escrutinioId: papeleta.escrutinioId,
        userId: papeleta.userId
      }
    });

  } catch (error: any) {
    console.error('Error fetching papeleta status:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
