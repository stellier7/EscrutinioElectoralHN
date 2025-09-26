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

    const escrutinioId = params.id;

    // Verificar que el escrutinio existe y el usuario puede acceder
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }

    // Verificar que el usuario puede acceder (solo el creador o admin)
    if (escrutinio.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado para ver este escrutinio' }, { status: 403 });
    }

    // Obtener todas las papeletas del escrutinio
    const papeletas = await prisma.papeleta.findMany({
      where: { escrutinioId },
      orderBy: { createdAt: 'asc' }
    });

    // Procesar los votesBuffer de todas las papeletas
    const allVotes: Array<{
      partyId: string;
      casillaNumber: number;
      votes: number;
    }> = [];

    papeletas.forEach(papeleta => {
      if (Array.isArray(papeleta.votesBuffer)) {
        papeleta.votesBuffer.forEach((vote: any) => {
          if (vote.partyId && vote.casillaNumber && vote.votes) {
            allVotes.push({
              partyId: vote.partyId,
              casillaNumber: vote.casillaNumber,
              votes: vote.votes
            });
          }
        });
      }
    });

    // Agrupar votos por partyId y casillaNumber
    const partyCounts: Record<string, Record<number, number>> = {};
    const appliedVotes: Record<string, Record<number, number>> = {};

    allVotes.forEach(vote => {
      if (!partyCounts[vote.partyId]) {
        partyCounts[vote.partyId] = {};
        appliedVotes[vote.partyId] = {};
      }
      
      if (!partyCounts[vote.partyId][vote.casillaNumber]) {
        partyCounts[vote.partyId][vote.casillaNumber] = 0;
        appliedVotes[vote.partyId][vote.casillaNumber] = 0;
      }
      
      partyCounts[vote.partyId][vote.casillaNumber] += vote.votes;
      appliedVotes[vote.partyId][vote.casillaNumber] += vote.votes;
    });

    // Contar papeletas cerradas
    const closedPapeletas = papeletas.filter(p => p.status === 'CLOSED').length;
    const totalPapeletas = papeletas.length;

    return NextResponse.json({
      success: true,
      data: {
        partyCounts,
        appliedVotes,
        papeletaNumber: totalPapeletas + 1, // Próxima papeleta
        closedPapeletas,
        totalPapeletas,
        escrutinioStatus: escrutinio.status,
        hasEdits: escrutinio.hasEdits,
        editCount: escrutinio.editCount,
        originalData: escrutinio.originalData || null
      }
    });

  } catch (error: any) {
    console.error('Error fetching papeletas:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
