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
    console.log('🔍 Buscando escrutinio para review:', escrutinioId);
    const escrutinio = await prisma.escrutinio.findUnique({
      where: {
        id: escrutinioId,
        // Remover filtro de status para debugging
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
        papeletas: true, // Incluir papeletas para votos legislativos
      }
    });

    if (!escrutinio) {
      console.log('❌ Escrutinio no encontrado:', escrutinioId);
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    console.log('✅ Escrutinio encontrado:', {
      id: escrutinio.id,
      status: escrutinio.status,
      actaImageUrl: escrutinio.actaImageUrl,
      electionLevel: escrutinio.electionLevel
    });

    // Verificar que el usuario tiene acceso al escrutinio
    // Permitir acceso si es el creador, admin, o cualquier usuario autenticado (transparencia)
    if (escrutinio.userId !== payload.userId && payload.role !== 'ADMIN') {
      // Por ahora permitimos que cualquier usuario autenticado vea cualquier escrutinio
      // Esto es para transparencia electoral - todos pueden revisar escrutinios públicos
      console.log('Usuario revisando escrutinio de otro usuario:', { 
        viewerId: payload.userId, 
        creatorId: escrutinio.userId,
        escrutinioId 
      });
    }

    // Procesar los datos de votos según el nivel electoral
    const candidatesMap = new Map();
    let totalVotes = 0;
    
    if (escrutinio.electionLevel === 'PRESIDENTIAL') {
      // Procesar votos presidenciales (candidates)
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
      totalVotes = Array.from(candidatesMap.values()).reduce((sum, candidate) => sum + candidate.votes, 0);
    } else if (escrutinio.electionLevel === 'LEGISLATIVE') {
      // Procesar votos legislativos (desde tabla votes directamente)
      console.log('🔄 Procesando votos legislativos desde tabla votes...');
      console.log('📊 Número de votos en DB:', escrutinio.votes.length);
      console.log('📊 Votos en DB:', escrutinio.votes.map(v => ({
        id: v.id,
        candidateId: v.candidateId,
        count: v.count,
        candidate: v.candidate
      })));
      
      // Procesar votos directamente desde la tabla votes
      escrutinio.votes.forEach((vote) => {
        if (vote.candidate && vote.candidate.electionLevel === 'LEGISLATIVE') {
          const candidateId = vote.candidateId;
          const partyId = vote.candidate.party;
          const casillaNumber = vote.candidate.number;
          
          console.log(`📊 Procesando voto legislativo:`, {
            candidateId,
            partyId,
            casillaNumber,
            count: vote.count
          });
          
          candidatesMap.set(candidateId, {
            id: candidateId,
            name: `Casilla ${casillaNumber}`,
            party: partyId,
            partyColor: '#e5e7eb', // Color por defecto
            number: casillaNumber,
            votes: vote.count
          });
          
          totalVotes += vote.count;
        }
      });
      
      console.log('📊 Votos legislativos procesados desde DB:', {
        totalVotes,
        candidatesCount: candidatesMap.size,
        candidates: Array.from(candidatesMap.values())
      });
    }

    const candidates = Array.from(candidatesMap.values());
    
    console.log('📊 Candidatos finales para review:', {
      electionLevel: escrutinio.electionLevel,
      candidatesCount: candidates.length,
      candidates: candidates,
      totalVotes: totalVotes
    });

    // Obtener la URL de la evidencia si existe
    const actaUrl = escrutinio.actaImageUrl || null;
    console.log('📸 Acta URL en review API:', {
      escrutinioId: escrutinio.id,
      actaImageUrl: escrutinio.actaImageUrl,
      actaUrl: actaUrl
    });

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
