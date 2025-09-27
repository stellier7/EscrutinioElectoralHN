import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
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

    if (!escrutinioId) {
      return NextResponse.json(
        { success: false, error: 'ID de escrutinio es requerido' },
        { status: 400 }
      );
    }

    // Buscar el escrutinio
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: {
        votes: {
          include: {
            candidate: true
          }
        },
        election: true,
        mesa: true
      }
    });

    if (!escrutinio) {
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que el usuario tenga acceso al escrutinio
    if (payload.role !== 'ADMIN' && escrutinio.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para acceder a este escrutinio' },
        { status: 403 }
      );
    }

    console.log(`📊 [VOTES API] Obteniendo votos para escrutinio ${escrutinioId}:`, {
      totalVotes: escrutinio.votes.length,
      electionLevel: escrutinio.electionLevel
    });

    return NextResponse.json({
      success: true,
      data: escrutinio.votes
    });

  } catch (error) {
    console.error('Error fetching votes for escrutinio:', error);
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