import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const papeletaId = params.id;
    const body = await request.json();
    const { userId, votesBuffer } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la papeleta existe y está abierta
    const papeleta = await prisma.papeleta.findUnique({
      where: { id: papeletaId },
      include: { 
        escrutinio: {
          select: {
            id: true,
            electionId: true,
            mesa: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    if (!papeleta) {
      return NextResponse.json(
        { success: false, error: 'Papeleta no encontrada' },
        { status: 404 }
      );
    }

    if (papeleta.status !== 'OPEN') {
      return NextResponse.json(
        { success: false, error: 'La papeleta no está abierta' },
        { status: 400 }
      );
    }

    if (!papeleta.escrutinio || !papeleta.escrutinio.electionId) {
      return NextResponse.json(
        { success: false, error: 'Escrutinio o electionId no encontrado' },
        { status: 400 }
      );
    }

    // Usar votesBuffer del cliente si está disponible, sino usar el de la base de datos
    const finalVotesBuffer = votesBuffer || (papeleta.votesBuffer as any[]) || [];
    
    if (!Array.isArray(finalVotesBuffer)) {
      return NextResponse.json(
        { success: false, error: 'votesBuffer debe ser un array' },
        { status: 400 }
      );
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔒 Cerrando papeleta con votos:', finalVotesBuffer.length);
    }

    // Validar carga electoral ANTES de cerrar papeleta (LEGISLATIVO) - OPTIMIZADO: todas las queries en paralelo
    try {
      const [
        mesaData,
        papeletasCounts,
        blankCandidate,
        nullCandidate
      ] = await Promise.all([
        // Obtener cargaElectoral
        prisma.mesa.findUnique({
          where: { id: papeleta.escrutinio.mesa.id },
          select: { cargaElectoral: true }
        }),
        // Contar papeletas cerradas y anuladas en una query
        prisma.papeleta.groupBy({
          by: ['status'],
          where: { 
            escrutinioId: papeleta.escrutinioId,
            status: { in: ['CLOSED', 'ANULADA'] }
          },
          _count: true
        }),
        // Buscar candidato BLANK
        prisma.candidate.findFirst({
          where: {
            electionId: papeleta.escrutinio.electionId,
            party: 'BLANK',
            electionLevel: 'LEGISLATIVE'
          },
          select: { id: true }
        }),
        // Buscar candidato NULL
        prisma.candidate.findFirst({
          where: {
            electionId: papeleta.escrutinio.electionId,
            party: 'NULL',
            electionLevel: 'LEGISLATIVE'
          },
          select: { id: true }
        })
      ]);

      const cargaElectoral = mesaData?.cargaElectoral;
      
      if (cargaElectoral !== null && cargaElectoral !== undefined) {
        const papeletasCerradas = papeletasCounts.find(p => p.status === 'CLOSED')?._count || 0;
        const papeletasAnuladas = papeletasCounts.find(p => p.status === 'ANULADA')?._count || 0;
        
        // Obtener conteos de blanco/nulo en paralelo
        const [blankVotesResult, nullVotesResult] = await Promise.all([
          blankCandidate 
            ? prisma.vote.aggregate({
                where: {
                  escrutinioId: papeleta.escrutinioId,
                  candidateId: blankCandidate.id
                },
                _sum: { count: true }
              })
            : Promise.resolve({ _sum: { count: 0 } }),
          nullCandidate
            ? prisma.vote.aggregate({
                where: {
                  escrutinioId: papeleta.escrutinioId,
                  candidateId: nullCandidate.id
                },
                _sum: { count: true }
              })
            : Promise.resolve({ _sum: { count: 0 } })
        ]);

        const blankVotes = Number(blankVotesResult._sum.count || 0);
        const nullVotes = Number(nullVotesResult._sum.count || 0);
        
        const totalConBlancoNulo = papeletasCerradas + papeletasAnuladas + blankVotes + nullVotes + 1;

        if (totalConBlancoNulo > cargaElectoral) {
          return NextResponse.json(
            {
              success: false,
              error: 'Carga electoral alcanzada',
              details: `Total papeletas: ${totalConBlancoNulo} / Máximo: ${cargaElectoral}`
            },
            { status: 400 }
          );
        }
      }
    } catch (cargaError) {
      // Si hay error al acceder a cargaElectoral, continuar sin validación
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [PAPELETA CLOSE] No se pudo validar carga electoral:', cargaError);
      }
    }

    // Aplicar votos del buffer a los contadores globales - OPTIMIZADO: batch operations
    await prisma.$transaction(async (tx) => {
      // Filtrar votos válidos
      const validVotes = finalVotesBuffer.filter(
        (vote: any) => vote.partyId && vote.casillaNumber !== undefined && vote.casillaNumber !== null
      );

      if (validVotes.length === 0) {
        // Si no hay votos válidos, solo cerrar la papeleta
        await tx.papeleta.update({
          where: { id: papeletaId },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            updatedAt: new Date(),
            votesBuffer: finalVotesBuffer
          }
        });
        return;
      }

      // OPTIMIZACIÓN: Cargar todos los candidatos necesarios de una vez
      const candidateKeys = validVotes.map((v: any) => ({
        electionId: papeleta.escrutinio.electionId,
        number: v.casillaNumber,
        party: v.partyId,
        electionLevel: 'LEGISLATIVE' as const
      }));

      // Buscar candidatos existentes en batch
      const existingCandidates = await tx.candidate.findMany({
        where: {
          electionId: papeleta.escrutinio.electionId,
          electionLevel: 'LEGISLATIVE',
          OR: candidateKeys.map(key => ({
            number: key.number,
            party: key.party
          }))
        }
      });

      // Crear mapa de candidatos por clave única
      const candidateMap = new Map<string, any>();
      existingCandidates.forEach(c => {
        const key = `${c.party}-${c.number}`;
        candidateMap.set(key, c);
      });

      // Crear candidatos faltantes en batch
      const candidatesToCreate = candidateKeys.filter(key => {
        const mapKey = `${key.party}-${key.number}`;
        return !candidateMap.has(mapKey);
      });

      if (candidatesToCreate.length > 0) {
        const newCandidates = await Promise.all(
          candidatesToCreate.map(key =>
            tx.candidate.create({
              data: {
                name: `Diputado ${key.number}`,
                party: key.party,
                number: key.number,
                electionId: papeleta.escrutinio.electionId,
                electionLevel: 'LEGISLATIVE',
                isActive: true
              }
            })
          )
        );

        newCandidates.forEach(c => {
          const key = `${c.party}-${c.number}`;
          candidateMap.set(key, c);
        });
      }

      // OPTIMIZACIÓN: Cargar todos los votos existentes de una vez
      const candidateIds = Array.from(candidateMap.values()).map(c => c.id);
      const existingVotes = await tx.vote.findMany({
        where: {
          escrutinioId: papeleta.escrutinioId,
          candidateId: { in: candidateIds }
        }
      });

      // Crear mapa de votos existentes por candidateId
      const voteMap = new Map<string, any>();
      existingVotes.forEach(v => {
        voteMap.set(v.candidateId, v);
      });

      // Preparar operaciones de actualización y creación
      const votesToUpdate: Array<{ id: string; count: number }> = [];
      const votesToCreate: Array<{ escrutinioId: string; candidateId: string; count: number }> = [];

      validVotes.forEach((vote: any) => {
        const candidateKey = `${vote.partyId}-${vote.casillaNumber}`;
        const candidate = candidateMap.get(candidateKey);
        
        if (!candidate) return;

        const existingVote = voteMap.get(candidate.id);
        if (existingVote) {
          votesToUpdate.push({ id: existingVote.id, count: existingVote.count + 1 });
        } else {
          votesToCreate.push({
            escrutinioId: papeleta.escrutinioId,
            candidateId: candidate.id,
            count: 1
          });
        }
      });

      // Ejecutar operaciones batch
      if (votesToUpdate.length > 0) {
        await Promise.all(
          votesToUpdate.map(v =>
            tx.vote.update({
              where: { id: v.id },
              data: { count: v.count }
            })
          )
        );
      }

      if (votesToCreate.length > 0) {
        await tx.vote.createMany({
          data: votesToCreate
        });
      }

      // Marcar papeleta como cerrada y actualizar votesBuffer
      await tx.papeleta.update({
        where: { id: papeletaId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          updatedAt: new Date(),
          votesBuffer: finalVotesBuffer
        }
      });
    });

    // TODO: AuditLogger.log({
    //   event: 'close_papeleta',
    //   papeletaId,
    //   userId,
    //   voteCount: votesBuffer.length,
    //   timestamp: Date.now()
    // });

    return NextResponse.json({
      success: true,
      data: {
        papeletaId,
        status: 'CLOSED',
        votesApplied: finalVotesBuffer.length,
        closedAt: new Date()
      }
    });

  } catch (error: any) {
    console.error('❌ Error closing papeleta:', error);
    console.error('❌ Error stack:', error?.stack);
    console.error('❌ Error message:', error?.message);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
}
