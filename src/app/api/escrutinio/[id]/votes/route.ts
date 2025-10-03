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

export async function POST(
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
    const body = await request.json();

    if (!escrutinioId) {
      return NextResponse.json(
        { success: false, error: 'ID de escrutinio es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el escrutinio existe y el usuario tiene acceso
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      select: { id: true, userId: true, electionLevel: true }
    });

    if (!escrutinio) {
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    if (payload.role !== 'ADMIN' && escrutinio.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para acceder a este escrutinio' },
        { status: 403 }
      );
    }

    console.log(`📊 [VOTES API] Guardando votos para escrutinio ${escrutinioId}:`, {
      votes: body.votes,
      electionLevel: escrutinio.electionLevel
    });

    // Procesar votos según el nivel de elección
    if (escrutinio.electionLevel === 'PRESIDENTIAL') {
      // Para presidencial: body.votes puede ser array de deltas o array de counts
      if (Array.isArray(body.votes)) {
        for (const vote of body.votes) {
          if (vote.candidateId) {
            // Si tiene 'delta', es un delta (incremento/decremento)
            if (typeof vote.delta === 'number') {
              // Aplicar delta al conteo actual
              const currentVote = await prisma.vote.findUnique({
                where: {
                  escrutinioId_candidateId: {
                    escrutinioId: escrutinioId,
                    candidateId: vote.candidateId
                  }
                }
              });

              const currentCount = currentVote?.count || 0;
              const newCount = Math.max(0, currentCount + vote.delta);

              if (newCount > 0) {
                await prisma.vote.upsert({
                  where: {
                    escrutinioId_candidateId: {
                      escrutinioId: escrutinioId,
                      candidateId: vote.candidateId
                    }
                  },
                  update: {
                    count: newCount
                  },
                  create: {
                    escrutinioId: escrutinioId,
                    candidateId: vote.candidateId,
                    count: newCount
                  }
                });
              } else if (currentVote) {
                // Si el conteo llega a 0, eliminar el voto
                await prisma.vote.delete({
                  where: {
                    escrutinioId_candidateId: {
                      escrutinioId: escrutinioId,
                      candidateId: vote.candidateId
                    }
                  }
                });
              }
            } else if (typeof vote.count === 'number' && vote.count > 0) {
              // Si tiene 'count', es un conteo absoluto
              await prisma.vote.upsert({
                where: {
                  escrutinioId_candidateId: {
                    escrutinioId: escrutinioId,
                    candidateId: vote.candidateId
                  }
                },
                update: {
                  count: vote.count
                },
                create: {
                  escrutinioId: escrutinioId,
                  candidateId: vote.candidateId,
                  count: vote.count
                }
              });
            }
          }
        }
      }
    } else if (escrutinio.electionLevel === 'LEGISLATIVE') {
      // Para legislativo: body.votes es un objeto { "party_slot": count }
      if (typeof body.votes === 'object' && body.votes !== null) {
        for (const [key, count] of Object.entries(body.votes)) {
          if (typeof count === 'number' && count > 0) {
            const [party, slot] = key.split('_');
            if (party && slot) {
              // Buscar candidato por partido y número
              const candidate = await prisma.candidate.findFirst({
                where: {
                  party: party,
                  number: parseInt(slot),
                  electionLevel: 'LEGISLATIVE'
                }
              });

              if (candidate) {
                await prisma.vote.upsert({
                  where: {
                    escrutinioId_candidateId: {
                      escrutinioId: escrutinioId,
                      candidateId: candidate.id
                    }
                  },
                  update: {
                    count: count
                  },
                  create: {
                    escrutinioId: escrutinioId,
                    candidateId: candidate.id,
                    count: count
                  }
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Votos guardados exitosamente'
    });

  } catch (error) {
    console.error('Error saving votes for escrutinio:', error);
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