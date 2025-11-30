import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPartyConfig } from '@/lib/party-config';

export const dynamic = 'force-dynamic';

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
      
      // Procesar votos blanco/nulo (candidatos especiales)
      const blankVote = escrutinio.votes.find(v => 
        v.candidate && 
        v.candidate.electionLevel === 'LEGISLATIVE' &&
        v.candidate.party === 'BLANK'
      );
      
      const nullVote = escrutinio.votes.find(v => 
        v.candidate && 
        v.candidate.electionLevel === 'LEGISLATIVE' &&
        v.candidate.party === 'NULL'
      );

      if (blankVote && blankVote.count > 0) {
        const partyConfig = getPartyConfig('BLANK');
        candidatesMap.set('BLANK_0', {
          id: 'BLANK_0',
          name: 'Voto en Blanco',
          party: 'BLANK',
          partyColor: partyConfig.color,
          number: 999,
          votes: blankVote.count
        });
        totalVotes += blankVote.count;
      }

      if (nullVote && nullVote.count > 0) {
        const partyConfig = getPartyConfig('NULL');
        candidatesMap.set('NULL_0', {
          id: 'NULL_0',
          name: 'Voto Nulo',
          party: 'NULL',
          partyColor: partyConfig.color,
          number: 998,
          votes: nullVote.count
        });
        totalVotes += nullVote.count;
      }
      
      console.log('📊 Votos legislativos procesados:', {
        totalVotes,
        candidatesCount: candidatesMap.size,
        candidatesWithVotes: Array.from(candidatesMap.values()).filter(c => c.votes > 0),
        blankVotes: blankVote?.count || 0,
        nullVotes: nullVote?.count || 0
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
    if (escrutinio.electionLevel === 'LEGISLATIVE') {
      // Asegurar que tenemos un array de papeletas (puede ser vacío)
      let papeletas = escrutinio.papeletas || [];
      
      console.log('📊 [REVIEW API] Calculando estadísticas de papeletas:', {
        escrutinioId: escrutinio.id,
        papeletasCount: papeletas.length,
        papeletas: papeletas.map(p => ({ id: p.id, status: p.status })),
        papeletasRaw: papeletas
      });
      
      // Debug: Verificar que las papeletas se están cargando correctamente
      if (papeletas.length === 0) {
        console.warn('⚠️ [REVIEW API] No se encontraron papeletas en el include, cargando directamente...');
        // Intentar cargar papeletas directamente si no están en el include
        try {
          const directPapeletas = await prisma.papeleta.findMany({
            where: { escrutinioId: escrutinio.id }
          });
          console.log('📊 [REVIEW API] Papeletas cargadas directamente:', directPapeletas.length, directPapeletas.map(p => ({ id: p.id, status: p.status })));
          if (directPapeletas.length > 0) {
            papeletas = directPapeletas;
          }
        } catch (error) {
          console.error('❌ [REVIEW API] Error cargando papeletas directamente:', error);
        }
      }
      
      const totalPapeletas = papeletas.length;
      const papeletasCerradas = papeletas.filter(p => p.status === 'CLOSED').length;
      const papeletasAnuladas = papeletas.filter(p => p.status === 'ANULADA').length;
      const papeletasAbiertas = papeletas.filter(p => p.status === 'OPEN').length;
      
      // Contar votos blanco/nulo - buscar en todos los votos
      const blankVote = escrutinio.votes.find(v => 
        v.candidate && 
        v.candidate.electionLevel === 'LEGISLATIVE' &&
        v.candidate.party === 'BLANK'
      );
      
      const nullVote = escrutinio.votes.find(v => 
        v.candidate && 
        v.candidate.electionLevel === 'LEGISLATIVE' &&
        v.candidate.party === 'NULL'
      );
      
      const blankVotes = blankVote?.count || 0;
      const nullVotes = nullVote?.count || 0;
      
      console.log('📊 [REVIEW API] Conteos individuales:', {
        totalPapeletas,
        papeletasCerradas,
        papeletasAnuladas,
        papeletasAbiertas,
        blankVotes,
        nullVotes,
        blankVoteFound: !!blankVote,
        nullVoteFound: !!nullVote,
        totalVotes: escrutinio.votes.length,
        votesWithCandidates: escrutinio.votes.filter(v => v.candidate).length,
        allVoteCandidates: escrutinio.votes.map(v => ({
          candidateId: v.candidateId,
          candidateParty: v.candidate?.party,
          candidateElectionLevel: v.candidate?.electionLevel,
          count: v.count
        }))
      });
      
      // Calcular total de papeletas digitales: cerradas + anuladas + blanco + nulo
      const totalDigitalPapeletas = papeletasCerradas + papeletasAnuladas + blankVotes + nullVotes;
      
      // Comparación con conteo físico (solo si existe)
      // NOTA: physicalBallotCount está temporalmente comentado en el schema
      // TODO: Descomentar cuando la migración se complete
      let integrityComparison = null;
      // const escrutinioWithPhysical = escrutinio as any; // Type assertion para campos opcionales
      // if (escrutinioWithPhysical.physicalBallotCount !== null && escrutinioWithPhysical.physicalBallotCount !== undefined) {
      //   const diferencia = escrutinioWithPhysical.physicalBallotCount - totalDigitalPapeletas;
      //   const integrityVerified = diferencia === 0;
      //   
      //   integrityComparison = {
      //     physicalBallotCount: escrutinioWithPhysical.physicalBallotCount,
      //     totalDigitalPapeletas,
      //     diferencia,
      //     integrityVerified,
      //     physicalBallotCountTimestamp: escrutinioWithPhysical.physicalBallotCountTimestamp?.toISOString() || null
      //   };
      // }
      
      // Asegurar que todos los valores son números válidos
      papeletasStats = {
        totalPapeletas: Number(totalPapeletas) || 0,
        papeletasCerradas: Number(papeletasCerradas) || 0,
        papeletasAnuladas: Number(papeletasAnuladas) || 0,
        papeletasAbiertas: Number(papeletasAbiertas) || 0,
        blankVotes: Number(blankVotes) || 0,
        nullVotes: Number(nullVotes) || 0,
        totalDigitalPapeletas: Number(totalDigitalPapeletas) || 0,
        escrutinioCorregido: escrutinio.hasEdits || false,
        vecesCorregido: escrutinio.editCount || 0,
        integrityComparison // Incluir comparación solo si existe physicalBallotCount
      };
      
      console.log('📊 [REVIEW API] Estadísticas de papeletas calculadas:', JSON.stringify(papeletasStats, null, 2));
    } else {
      console.log('📊 [REVIEW API] No es escrutinio legislativo, omitiendo estadísticas de papeletas');
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

// POST /api/escrutinio/[id]/review - Actualizar conteo físico de papeletas (opcional)
export async function POST(
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
    const body = await request.json();
    const { physicalBallotCount } = body;

    // Validar que el conteo sea un número >= 0
    if (physicalBallotCount !== null && physicalBallotCount !== undefined) {
      if (typeof physicalBallotCount !== 'number' || physicalBallotCount < 0) {
        return NextResponse.json(
          { success: false, error: 'El conteo físico debe ser un número mayor o igual a 0' },
          { status: 400 }
        );
      }
    }

    // Verificar que el escrutinio existe
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: {
        papeletas: true
      }
    });

    if (!escrutinio) {
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar conteo físico
    // NOTA: physicalBallotCount está temporalmente comentado en el schema
    // TODO: Descomentar cuando la migración se complete
    const updatedEscrutinio = await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: {
        // physicalBallotCount: physicalBallotCount !== null && physicalBallotCount !== undefined ? physicalBallotCount : null,
        // physicalBallotCountTimestamp: physicalBallotCount !== null && physicalBallotCount !== undefined ? new Date() : null
      },
      include: {
        papeletas: true
      }
    });

    // Calcular comparación automática
    let integrityComparison = null;
    if (physicalBallotCount !== null && physicalBallotCount !== undefined && escrutinio.electionLevel === 'LEGISLATIVE') {
      const papeletasCerradas = updatedEscrutinio.papeletas.filter(p => p.status === 'CLOSED').length;
      const papeletasAnuladas = updatedEscrutinio.papeletas.filter(p => p.status === 'ANULADA').length;
      const totalDigitalPapeletas = papeletasCerradas + papeletasAnuladas;
      const diferencia = physicalBallotCount - totalDigitalPapeletas;
      const integrityVerified = diferencia === 0;

      integrityComparison = {
        physicalBallotCount,
        totalDigitalPapeletas,
        diferencia,
        integrityVerified,
        // physicalBallotCountTimestamp: updatedEscrutinio.physicalBallotCountTimestamp?.toISOString() || null
        physicalBallotCountTimestamp: null // Temporalmente deshabilitado hasta que la migración se complete
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        // physicalBallotCount: updatedEscrutinio.physicalBallotCount,
        // physicalBallotCountTimestamp: updatedEscrutinio.physicalBallotCountTimestamp?.toISOString() || null,
        physicalBallotCount: physicalBallotCount !== null && physicalBallotCount !== undefined ? physicalBallotCount : null,
        physicalBallotCountTimestamp: null, // Temporalmente deshabilitado hasta que la migración se complete
        integrityComparison
      }
    });

  } catch (error) {
    console.error('Error actualizando conteo físico:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
