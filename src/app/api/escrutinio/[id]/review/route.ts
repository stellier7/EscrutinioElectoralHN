import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Obtener el escrutinio con todos los datos relacionados
    const escrutinio = await prisma.escrutinio.findUnique({
      where: {
        id: escrutinioId,
        status: 'COMPLETED' // Solo escrutinios completados
      },
      include: {
        mesa: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        votes: {
          include: {
            candidate: true
          }
        },
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
    if (escrutinio.userId !== payload.userId && payload.role !== 'ADMIN') {
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
          party: vote.candidate.party,
          partyColor: '#e5e7eb', // Color por defecto
          number: vote.candidate.number,
          votes: 0
        });
      }
      candidatesMap.get(candidateId).votes += vote.count;
    });

    const candidates = Array.from(candidatesMap.values());
    const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);

    // Obtener la URL de la evidencia si existe
    const actaUrl = escrutinio.actaImageUrl || null;

    // Datos del GPS si están disponibles
    const gps = escrutinio.latitude && escrutinio.longitude ? {
      latitude: escrutinio.latitude,
      longitude: escrutinio.longitude,
      accuracy: escrutinio.locationAccuracy || 0
    } : null;

    const escrutinioData = {
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.location,
      department: escrutinio.mesa.department,
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
