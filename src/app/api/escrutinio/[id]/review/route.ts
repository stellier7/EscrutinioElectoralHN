import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPartyConfig } from '@/lib/party-config';

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
    console.log('🔍 Buscando escrutinio para revisión:', escrutinioId);
    const escrutinio = await prisma.escrutinio.findUnique({
      where: {
        id: escrutinioId,
        // Remover filtro de status para depuración
      },
      include: {
        mesa: {
          select: {
            id: true,
            number: true,
            location: true,
            department: true,
            municipality: true,
            area: true,
            address: true,
            isActive: true,
            // cargaElectoral no se necesita para revisión, evitar errores si la migración no se ha ejecutado
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
      console.log('🔄 Procesando votos presidenciales...');
      console.log('📊 Número de votos en DB:', escrutinio.votes.length);
      console.log('📊 Votos sin procesar:', escrutinio.votes);
      
      escrutinio.votes.forEach(vote => {
        console.log('🗳️ Procesando voto:', {
          candidateId: vote.candidateId,
          candidateName: vote.candidate?.name,
          candidateParty: vote.candidate?.party,
          voteCount: vote.count
        });
        
        const candidateId = vote.candidateId;
        if (!candidatesMap.has(candidateId)) {
          const partyConfig = getPartyConfig(vote.candidate.party);
          candidatesMap.set(candidateId, {
            id: candidateId,
            name: vote.candidate.name,
            party: vote.candidate.party,
            partyColor: partyConfig.color,
            number: vote.candidate.number,
            votes: 0
          });
          console.log('➕ Nuevo candidato agregado:', candidateId);
        }
        candidatesMap.get(candidateId).votes += vote.count;
        console.log('📈 Votos actualizados para', candidateId, ':', candidatesMap.get(candidateId).votes);
      });
      
      totalVotes = Array.from(candidatesMap.values()).reduce((sum, candidate) => sum + candidate.votes, 0);
      console.log('📊 Total de votos presidenciales calculado:', totalVotes);
      console.log('📊 Candidatos finales:', Array.from(candidatesMap.values()));
    } else if (escrutinio.electionLevel === 'LEGISLATIVE') {
      // Procesar votos legislativos - SNAPSHOT del conteo actual
      console.log('🔄 Procesando votos legislativos (snapshot del conteo)...');
      console.log('📊 Número de votos en DB:', escrutinio.votes.length);
      
      // Leer el snapshot del conteo desde originalData si existe
      let snapshotData = null;
      if (escrutinio.originalData && typeof escrutinio.originalData === 'object') {
        snapshotData = escrutinio.originalData as any;
        console.log('📊 Snapshot encontrado en originalData:', snapshotData);
      }
      
      // Si no hay snapshot, usar los votos de la base de datos (respaldo)
      if (!snapshotData || !snapshotData.partyCounts) {
        console.log('📊 No hay snapshot, usando votos de DB como respaldo...');
        
        // Crear candidatos basados en los partidos conocidos
        const parties = ['pdc', 'libre', 'pinu-sd', 'liberal', 'nacional'];
        const diputadosPerParty = 8;
        
        parties.forEach((partyId, partyIndex) => {
          for (let casilla = 1; casilla <= diputadosPerParty; casilla++) {
            const casillaNumber = partyIndex * diputadosPerParty + casilla;
            const candidateId = `${partyId}_${casillaNumber}`;
            
            // Buscar voto en la base de datos
            const vote = escrutinio.votes.find(v => 
              v.candidate && 
              v.candidate.electionLevel === 'LEGISLATIVE' &&
              v.candidate.party === partyId &&
              v.candidate.number === casillaNumber
            );
            
            const voteCount = vote ? vote.count : 0;
            
            candidatesMap.set(candidateId, {
              id: candidateId,
              name: `Casilla ${casillaNumber}`,
              party: partyId,
              partyColor: '#e5e7eb',
              number: casillaNumber,
              votes: voteCount
            });
            
            totalVotes += voteCount;
          }
        });
      } else {
        // Usar el snapshot del conteo (PRINCIPAL)
        console.log('📊 Usando snapshot del conteo:', snapshotData.partyCounts);
        
        // Obtener información de la mesa para determinar diputados por partido
        const diputadosPerParty = 8; // Valor por defecto
        const parties = ['pdc', 'libre', 'pinu-sd', 'liberal', 'nacional'];
        
        Object.entries(snapshotData.partyCounts).forEach(([key, count]) => {
          const [partyId, casillaNumber] = key.split('_');
          const candidateId = key;
          const casillaNum = parseInt(casillaNumber);
          const voteCount = count as number;
          
          // Solo mostrar casillas que tienen votos
          if (voteCount > 0) {
            candidatesMap.set(candidateId, {
              id: candidateId,
              name: `Casilla ${casillaNum}`,
              party: partyId,
              partyColor: '#e5e7eb',
              number: casillaNum,
              votes: voteCount
            });
            
            totalVotes += voteCount;
          }
        });
        
        // También agregar casillas sin votos para mostrar el rango completo
        parties.forEach((partyId, partyIndex) => {
          for (let casilla = 1; casilla <= diputadosPerParty; casilla++) {
            const casillaNumber = partyIndex * diputadosPerParty + casilla;
            const candidateId = `${partyId}_${casillaNumber}`;
            
            // Si no está en el mapa, agregarlo con 0 votos
            if (!candidatesMap.has(candidateId)) {
              candidatesMap.set(candidateId, {
                id: candidateId,
                name: `Casilla ${casillaNumber}`,
                party: partyId,
                partyColor: '#e5e7eb',
                number: casillaNumber,
                votes: 0
              });
            }
          }
        });
      }
      
      console.log('📊 Votos legislativos procesados:', {
        totalVotes,
        candidatesCount: candidatesMap.size,
        candidatesWithVotes: Array.from(candidatesMap.values()).filter(c => c.votes > 0)
      });
    }

    const candidates = Array.from(candidatesMap.values());
    
    console.log('📊 Candidatos finales para revisión:', {
      electionLevel: escrutinio.electionLevel,
      candidatesCount: candidates.length,
      candidates: candidates,
      totalVotes: totalVotes
    });

    // Obtener la URL de la evidencia si existe
    const actaUrl = escrutinio.actaImageUrl || null;
    console.log('📸 URL del acta en API de revisión:', {
      escrutinioId: escrutinio.id,
      actaImageUrl: escrutinio.actaImageUrl,
      actaUrl: actaUrl
    });

    // Datos del GPS inicial si están disponibles (respetar privacidad)
    const initialGps = escrutinio.gpsHidden ? {
      latitude: 0,
      longitude: 0,
      accuracy: 0
    } : (escrutinio.latitude && escrutinio.longitude ? {
      latitude: escrutinio.latitude,
      longitude: escrutinio.longitude,
      accuracy: escrutinio.locationAccuracy || 0
    } : null);

    // Datos del GPS final si están disponibles (respetar privacidad)
    const finalGps = escrutinio.gpsHidden ? {
      latitude: 0,
      longitude: 0,
      accuracy: 0
    } : (escrutinio.finalLatitude && escrutinio.finalLongitude ? {
      latitude: escrutinio.finalLatitude,
      longitude: escrutinio.finalLongitude,
      accuracy: escrutinio.finalLocationAccuracy || 0
    } : null);

    console.log('📍 [API REVISIÓN] Datos GPS para escrutinio:', {
      escrutinioId: escrutinio.id,
      initialLatitude: escrutinio.latitude,
      initialLongitude: escrutinio.longitude,
      initialAccuracy: escrutinio.locationAccuracy,
      finalLatitude: escrutinio.finalLatitude,
      finalLongitude: escrutinio.finalLongitude,
      finalAccuracy: escrutinio.finalLocationAccuracy,
      initialGpsObject: initialGps,
      finalGpsObject: finalGps
    });

    // Calcular estadísticas de papeletas (solo para escrutinios legislativos)
    let papeletasStats = null;
    if (escrutinio.electionLevel === 'LEGISLATIVE' && escrutinio.papeletas) {
      const totalPapeletas = escrutinio.papeletas.length;
      const papeletasCerradas = escrutinio.papeletas.filter(p => p.status === 'CLOSED').length;
      const papeletasAnuladas = escrutinio.papeletas.filter(p => p.status === 'ANULADA').length;
      
      papeletasStats = {
        totalPapeletas,
        papeletasCerradas,
        papeletasAnuladas,
        escrutinioCorregido: escrutinio.hasEdits || false,
        vecesCorregido: escrutinio.editCount || 0
      };
      
      console.log('📊 Estadísticas de papeletas calculadas:', papeletasStats);
    }

    const escrutinioData: any = {
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.location,
      department: escrutinio.mesa.department,
      electionLevel: escrutinio.electionLevel,
      startedAt: escrutinio.startedAt.toISOString(),
      completedAt: escrutinio.completedAt?.toISOString() || escrutinio.updatedAt.toISOString(),
      totalVotes,
      candidates,
      actaUrl,
      actaImageSource: escrutinio.actaImageSource || null,
      initialGps,
      finalGps,
      user: escrutinio.user,
      // Campos de privacidad GPS
      gpsHidden: escrutinio.gpsHidden,
      gpsHiddenReason: escrutinio.gpsHiddenReason,
      gpsHiddenBy: escrutinio.gpsHiddenBy,
      gpsHiddenAt: escrutinio.gpsHiddenAt?.toISOString()
    };

    // Incluir estadísticas de papeletas solo si es legislativo
    if (papeletasStats) {
      escrutinioData.papeletasStats = papeletasStats;
    }

    return NextResponse.json({
      success: true,
      data: escrutinioData
    });

  } catch (error) {
    console.error('Error obteniendo escrutinio para revisión:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
