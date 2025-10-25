import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { AuditLogger } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/admin/sessions/[id]/close - Cerrar una sesión activa
export async function POST(
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

    // Verificar que la sesión existe y está activa
    const session = await prisma.escrutinioSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    if (!session.isActive) {
      return NextResponse.json(
        { success: false, error: 'La sesión no está activa' },
        { status: 400 }
      );
    }

    if (session.isClosed) {
      return NextResponse.json(
        { success: false, error: 'La sesión ya está cerrada' },
        { status: 400 }
      );
    }

    // Obtener estadísticas antes de cerrar
    const escrutinios = await prisma.escrutinio.findMany({
      where: { sessionId },
      include: {
        votes: true,
        _count: {
          select: {
            votes: true,
            papeletas: true,
            corrections: true
          }
        }
      }
    });

    const totalVotes = escrutinios.reduce((sum, escrutinio) => {
      return sum + escrutinio.votes.reduce((voteSum, vote) => voteSum + vote.count, 0);
    }, 0);

    const uniqueUsers = new Set(escrutinios.map(e => e.userId)).size;
    const completedEscrutinios = escrutinios.filter(e => e.isCompleted).length;

    // Cerrar la sesión
    const result = await prisma.escrutinioSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        isClosed: true,
        closedAt: new Date(),
        closedBy: payload.userId
      }
    });

    // Registrar en audit log con estadísticas
    await AuditLogger.log(
      'CLOSE_SESSION',
      `Sesión cerrada: ${result.name}`,
      payload.userId,
      {
        sessionId: result.id,
        sessionName: result.name,
        stats: {
          totalEscrutinios: escrutinios.length,
          completedEscrutinios,
          totalVotes,
          uniqueUsers
        }
      }
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Sesión "${result.name}" cerrada exitosamente`,
      stats: {
        totalEscrutinios: escrutinios.length,
        completedEscrutinios,
        totalVotes,
        uniqueUsers
      }
    });

  } catch (error: any) {
    console.error('Error closing session:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
