import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const escrutinioId = params.id;
    
    console.log('🔍 [DEBUG] Verificando votos legislativos para escrutinio:', escrutinioId);
    
    // Obtener el escrutinio con todos sus votos
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: {
        votes: {
          include: {
            candidate: true
          }
        },
        papeletas: true
      }
    });
    
    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }
    
    console.log('🔍 [DEBUG] Escrutinio encontrado:', {
      id: escrutinio.id,
      electionLevel: escrutinio.electionLevel,
      status: escrutinio.status,
      votesCount: escrutinio.votes.length,
      papeletasCount: escrutinio.papeletas.length
    });
    
    // Procesar votos legislativos
    const legislativeVotes = escrutinio.votes.filter(vote => 
      vote.candidate && vote.candidate.electionLevel === 'LEGISLATIVE'
    );
    
    console.log('🔍 [DEBUG] Votos legislativos encontrados:', legislativeVotes.length);
    
    const processedVotes = legislativeVotes.map(vote => ({
      id: vote.id,
      candidateId: vote.candidateId,
      count: vote.count,
      candidate: {
        id: vote.candidate.id,
        name: vote.candidate.name,
        party: vote.candidate.party,
        number: vote.candidate.number,
        electionLevel: vote.candidate.electionLevel
      }
    }));
    
    console.log('🔍 [DEBUG] Votos procesados:', processedVotes);
    
    // También verificar papeletas
    const papeletasWithVotes = escrutinio.papeletas.filter(p => 
      Array.isArray(p.votesBuffer) && p.votesBuffer.length > 0
    );
    
    console.log('🔍 [DEBUG] Papeletas con votos:', papeletasWithVotes.length);
    
    return NextResponse.json({
      success: true,
      data: {
        escrutinio: {
          id: escrutinio.id,
          electionLevel: escrutinio.electionLevel,
          status: escrutinio.status
        },
        votes: {
          total: escrutinio.votes.length,
          legislative: legislativeVotes.length,
          processed: processedVotes
        },
        papeletas: {
          total: escrutinio.papeletas.length,
          withVotes: papeletasWithVotes.length,
          details: escrutinio.papeletas.map(p => ({
            id: p.id,
            status: p.status,
            votesBufferLength: Array.isArray(p.votesBuffer) ? p.votesBuffer.length : 0,
            votesBuffer: p.votesBuffer
          }))
        }
      }
    });
    
  } catch (error: any) {
    console.error('❌ [DEBUG] Error verificando votos legislativos:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    );
  }
}
