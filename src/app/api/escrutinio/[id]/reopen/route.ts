import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    const escrutinioId = params.id;
    const existing = await prisma.escrutinio.findUnique({ 
      where: { id: escrutinioId },
      include: { mesa: true }
    });
    if (!existing) return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });

    // Solo permitir reabrir escrutinios que están CLOSED
    if (existing.status !== 'CLOSED') {
      return NextResponse.json({ success: false, error: 'Solo se pueden reabrir escrutinios cerrados' }, { status: 400 });
    }

    // Crear snapshot de los votos actuales antes de reabrir (para auditoría)
    const currentVotes = await prisma.vote.findMany({
      where: { escrutinioId },
      include: { candidate: true },
    });

    const voteSnapshot = currentVotes.map(vote => ({
      candidateId: vote.candidateId,
      candidateName: vote.candidate.name,
      party: vote.candidate.party,
      count: vote.count,
    }));

    // Actualizar status a COMPLETED (reabierto para edición)
    await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: { status: 'COMPLETED' },
    });

    // Crear log de auditoría con snapshot de votos
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'REOPEN_ESCRUTINIO',
        description: `Escrutinio reabierto para edición en JRV ${existing.mesa.numero}`,
        metadata: {
          escrutinioId,
          mesaNumber: existing.mesa.numero,
          electionLevel: existing.electionLevel,
          voteSnapshotBeforeReopen: voteSnapshot,
          timestamp: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error reabriendo escrutinio:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
