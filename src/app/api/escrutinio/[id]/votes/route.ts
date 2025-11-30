import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { withDatabaseRetry, isDatabaseConnectionError, formatDatabaseError } from '@/lib/db-operations';

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
            // cargaElectoral no se necesita para GET, evitar errores si la migración no se ha ejecutado
          }
        }
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

  } catch (error: any) {
    // Log detailed error information
    console.error('❌ [VOTES API] Error obteniendo votos:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      escrutinioId: params?.id,
      userId: payload?.userId,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (isDatabaseConnectionError(error)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Error de conexión con la base de datos. Por favor, intenta de nuevo en unos momentos.',
            details: formatDatabaseError(error, 'obtener votos')
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? formatDatabaseError(error, 'error genérico') : 'Unknown error'
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
      include: {
        mesa: {
          select: {
            id: true,
            number: true,
            // cargaElectoral se obtendrá después si existe
          }
        },
        votes: {
          select: {
            count: true
          }
        },
        election: {
          select: {
            id: true
          }
        }
      }
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

    // Validar carga electoral ANTES de procesar votos (solo para PRESIDENCIAL)
    if (escrutinio.electionLevel === 'PRESIDENTIAL' && Array.isArray(body.votes)) {
      try {
        // Obtener cargaElectoral de la mesa
        const mesaWithCarga = await prisma.$queryRaw<Array<{ cargaElectoral: number | null }>>`
          SELECT "cargaElectoral" FROM "Mesa" WHERE id = ${escrutinio.mesa.id}
        `.catch(() => null);

        const cargaElectoral = mesaWithCarga?.[0]?.cargaElectoral;
        
        if (cargaElectoral !== null && cargaElectoral !== undefined) {
          // Calcular total de votos actuales
          const currentTotalVotes = escrutinio.votes.reduce((sum, vote) => sum + vote.count, 0);
          
          // Calcular cuántos votos se agregarían con los deltas
          let votesToAdd = 0;
          for (const vote of body.votes) {
            if (typeof vote.delta === 'number' && vote.delta > 0) {
              votesToAdd += vote.delta;
            } else if (typeof vote.count === 'number' && vote.count > 0) {
              // Para conteos absolutos, necesitamos verificar si ya existe
              // Por simplicidad, asumimos que se agrega el conteo completo
              // (en la práctica, esto se ajustará en la transacción)
              votesToAdd += vote.count;
            }
          }
          
          const projectedTotal = currentTotalVotes + votesToAdd;
          
          // BLOQUEO HARD: Si el total proyectado >= cargaElectoral, retornar error 400
          if (projectedTotal >= cargaElectoral) {
            console.warn(`🚫 [VOTES API] Carga electoral alcanzada en JRV ${escrutinio.mesa.number}: ${projectedTotal} >= ${cargaElectoral}`);
            
            // Loguear bloqueo
            try {
              await prisma.auditLog.create({
                data: {
                  userId: payload.userId,
                  action: 'CORRECTION',
                  description: `Carga electoral alcanzada - bloqueo hard: ${projectedTotal} >= ${cargaElectoral} (JRV ${escrutinio.mesa.number})`,
                  metadata: JSON.stringify({
                    escrutinioId,
                    currentTotal: currentTotalVotes,
                    votesToAdd,
                    projectedTotal,
                    cargaElectoral,
                    jrvNumber: escrutinio.mesa.number
                  })
                }
              });
            } catch (auditError) {
              console.error('Failed to log electoral load block:', auditError);
            }

            return NextResponse.json(
              {
                success: false,
                error: 'Carga electoral alcanzada',
                details: `Total votos proyectado: ${projectedTotal} / Máximo: ${cargaElectoral}`
              },
              { status: 400 }
            );
          }
        }
      } catch (cargaError) {
        // Si hay error al acceder a cargaElectoral, continuar sin validación
        console.warn('⚠️ [VOTES API] No se pudo validar carga electoral (columna puede no existir aún):', cargaError);
      }
    }

    // Procesar votos según el nivel de elección
    if (escrutinio.electionLevel === 'PRESIDENTIAL') {
      // Para presidencial: body.votes puede ser array de deltas o array de counts
      if (Array.isArray(body.votes)) {
        // CRÍTICO: Procesar todos los votos en una transacción para evitar duplicados
        await prisma.$transaction(async (tx) => {
        for (const vote of body.votes) {
            // CRÍTICO: Verificar batch duplicado ANTES de procesar cada voto
            if (vote.clientBatchId) {
              const existingBatch = await tx.processedBatch.findUnique({
                where: { clientBatchId: vote.clientBatchId }
              });
              
              if (existingBatch) {
                console.warn(`⚠️ [VOTES API] Batch duplicado detectado y saltado: ${vote.clientBatchId}`);
                continue; // Saltar este voto completamente, ya fue procesado
              }
            }
            
          if (vote.candidateId) {
              // Manejar candidatos especiales (BLANK_VOTE, NULL_VOTE)
              let actualCandidateId = vote.candidateId;
              
              if (vote.candidateId === 'BLANK_VOTE' || vote.candidateId === 'NULL_VOTE') {
                // Buscar o crear candidato especial
                const specialCandidateName = vote.candidateId === 'BLANK_VOTE' ? 'Voto en Blanco' : 'Voto Nulo';
                const specialCandidateParty = vote.candidateId === 'BLANK_VOTE' ? 'BLANK' : 'NULL';
                
                let specialCandidate = await tx.candidate.findFirst({
                  where: {
                    electionId: escrutinio.electionId,
                    name: specialCandidateName,
                    party: specialCandidateParty,
                    electionLevel: 'PRESIDENTIAL'
                  }
                });
                
                if (!specialCandidate) {
                  // Crear candidato especial si no existe
                  specialCandidate = await tx.candidate.create({
                    data: {
                      name: specialCandidateName,
                      party: specialCandidateParty,
                      number: vote.candidateId === 'BLANK_VOTE' ? 999 : 998, // Números especiales
                      electionId: escrutinio.electionId,
                      electionLevel: 'PRESIDENTIAL',
                      isActive: true
                    }
                  });
                  console.log(`➕ [VOTES API] Candidato especial creado: ${specialCandidateName} (ID: ${specialCandidate.id})`);
                }
                
                actualCandidateId = specialCandidate.id;
              }
              
            // Si tiene 'delta', es un delta (incremento/decremento)
            if (typeof vote.delta === 'number') {
              // Aplicar delta al conteo actual
                const currentVote = await tx.vote.findFirst({
                where: {
                  escrutinioId: escrutinioId,
                    candidateId: actualCandidateId
                }
              });

              const currentCount = currentVote?.count || 0;
              const newCount = Math.max(0, currentCount + vote.delta);

              if (newCount > 0) {
                if (currentVote) {
                    await tx.vote.update({
                    where: { id: currentVote.id },
                    data: { count: newCount }
                  });
                } else {
                    await tx.vote.create({
                    data: {
                      escrutinioId: escrutinioId,
                        candidateId: actualCandidateId,
                      count: newCount
                    }
                  });
                }
              } else if (currentVote) {
                // Si el conteo llega a 0, eliminar el voto
                  await tx.vote.delete({
                  where: { id: currentVote.id }
                });
              }
                
                // CRÍTICO: Marcar batch como procesado DESPUÉS de aplicar el voto exitosamente
                if (vote.clientBatchId) {
                  try {
                    await tx.processedBatch.create({
                      data: {
                        clientBatchId: vote.clientBatchId,
                        escrutinioId: escrutinioId,
                        userId: payload.userId,
                        processedVotes: 1
                      }
                    });
                  } catch (batchError: any) {
                    // Si falla (por ejemplo, ya existe), solo loguear, no fallar el voto
                    if (batchError.code !== 'P2002') { // P2002 = unique constraint violation
                      console.error('Error marcando batch como procesado:', batchError);
                    }
                  }
                }
            } else if (typeof vote.count === 'number' && vote.count > 0) {
              // Si tiene 'count', es un conteo absoluto
                const existingVote = await tx.vote.findFirst({
                where: {
                  escrutinioId: escrutinioId,
                    candidateId: actualCandidateId
                }
              });

              if (existingVote) {
                  await tx.vote.update({
                  where: { id: existingVote.id },
                  data: { count: vote.count }
                });
              } else {
                  await tx.vote.create({
                  data: {
                    escrutinioId: escrutinioId,
                      candidateId: actualCandidateId,
                    count: vote.count
                  }
                });
              }
                
                // CRÍTICO: Marcar batch como procesado DESPUÉS de aplicar el voto exitosamente
                if (vote.clientBatchId) {
                  try {
                    await tx.processedBatch.create({
                      data: {
                        clientBatchId: vote.clientBatchId,
                        escrutinioId: escrutinioId,
                        userId: payload.userId,
                        processedVotes: 1
            }
                    });
                  } catch (batchError: any) {
                    // Si falla (por ejemplo, ya existe), solo loguear, no fallar el voto
                    if (batchError.code !== 'P2002') { // P2002 = unique constraint violation
                      console.error('Error marcando batch como procesado:', batchError);
                    }
                  }
                }
              }
            }
          }
        });
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
                const existingVote = await prisma.vote.findFirst({
                  where: {
                    escrutinioId: escrutinioId,
                    candidateId: candidate.id
                  }
                });

                if (existingVote) {
                  await prisma.vote.update({
                    where: { id: existingVote.id },
                    data: { count: count }
                  });
                } else {
                  await prisma.vote.create({
                    data: {
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
    }


    return NextResponse.json({
      success: true,
      message: 'Votos guardados exitosamente'
    });

  } catch (error: any) {
    // Log detailed error information
    console.error('❌ [VOTES API] Error crítico guardando votos:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      escrutinioId: params?.id,
      userId: payload?.userId,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (error instanceof Error) {
      // Database connection errors - return 503 Service Unavailable
      if (isDatabaseConnectionError(error)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Error de conexión con la base de datos. Por favor, intenta de nuevo en unos momentos.',
            details: formatDatabaseError(error, 'guardar votos')
          },
          { status: 503 }
        );
      }

      // Transaction errors - provide more context
      if (error.message.includes('transaction') || error.message.includes('deadlock')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Error al procesar la transacción. Por favor, intenta de nuevo.',
            details: formatDatabaseError(error, 'transacción de votos')
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? formatDatabaseError(error, 'error genérico') : 'Unknown error'
      },
      { status: 500 }
    );
  }
}