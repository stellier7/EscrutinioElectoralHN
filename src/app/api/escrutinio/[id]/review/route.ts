import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const escrutinioId = params.id;

    // Obtener el escrutinio con todos los datos relacionados
    const escrutinio = await prisma.escrutinio.findUnique({
      where: {
        id: escrutinioId,
        status: 'COMPLETED' // Solo escrutinios completados
      },
      include: {
        mesa: {
          include: {
            department: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        votes: {
          include: {
            candidate: {
              include: {
                party: true
              }
            }
          }
        },
        evidence: true
      }
    });

    if (!escrutinio) {
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que el usuario tiene acceso al escrutinio
    // (opcional: solo el usuario que lo creó o admins)
    if (escrutinio.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No tienes acceso a este escrutinio' },
        { status: 403 }
      );
    }

    // Procesar los datos de votos por candidato
    const candidatesMap = new Map();
    
    escrutinio.votes.forEach(vote => {
      const candidateId = vote.candidateId;
      if (!candidatesMap.has(candidateId)) {
        candidatesMap.set(candidateId, {
          id: candidateId,
          name: vote.candidate.name,
          party: vote.candidate.party.name,
          partyColor: vote.candidate.party.color,
          number: vote.candidate.number,
          votes: 0
        });
      }
      candidatesMap.get(candidateId).votes += vote.count;
    });

    const candidates = Array.from(candidatesMap.values());
    const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);

    // Obtener la URL de la evidencia si existe
    const actaUrl = escrutinio.evidence.length > 0 ? escrutinio.evidence[0].url : null;

    // Datos del GPS si están disponibles
    const gps = escrutinio.gpsLatitude && escrutinio.gpsLongitude ? {
      latitude: escrutinio.gpsLatitude,
      longitude: escrutinio.gpsLongitude,
      accuracy: escrutinio.gpsAccuracy || 0
    } : null;

    const escrutinioData = {
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.name,
      department: escrutinio.mesa.department.name,
      electionLevel: escrutinio.electionLevel,
      completedAt: escrutinio.completedAt?.toISOString() || escrutinio.updatedAt.toISOString(),
      totalVotes,
      candidates,
      actaUrl,
      gps,
      user: escrutinio.user
    };

    return NextResponse.json({
      success: true,
      data: escrutinioData
    });

  } catch (error) {
    console.error('Error fetching escrutinio for review:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
