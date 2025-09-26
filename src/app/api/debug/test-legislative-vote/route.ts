import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { escrutinioId, partyId, casillaNumber } = body;
    
    console.log('🧪 [TEST] Creando voto de prueba:', { escrutinioId, partyId, casillaNumber });
    
    // Obtener el escrutinio
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: { election: true }
    });
    
    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }
    
    // Buscar o crear candidato
    let candidate = await prisma.candidate.findFirst({
      where: {
        electionId: escrutinio.electionId,
        number: casillaNumber,
        party: partyId,
        electionLevel: 'LEGISLATIVE'
      }
    });
    
    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          name: `Diputado ${casillaNumber}`,
          party: partyId,
          number: casillaNumber,
          electionId: escrutinio.electionId,
          electionLevel: 'LEGISLATIVE',
          isActive: true
        }
      });
      console.log('🧪 [TEST] Candidato creado:', candidate);
    } else {
      console.log('🧪 [TEST] Candidato encontrado:', candidate);
    }
    
    // Crear o actualizar voto
    const existingVote = await prisma.vote.findUnique({
      where: {
        escrutinioId_candidateId: {
          escrutinioId,
          candidateId: candidate.id
        }
      }
    });
    
    if (existingVote) {
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: { count: existingVote.count + 1 }
      });
      console.log('🧪 [TEST] Voto actualizado:', existingVote.id, 'nuevo count:', existingVote.count + 1);
    } else {
      const newVote = await prisma.vote.create({
        data: {
          escrutinioId,
          candidateId: candidate.id,
          count: 1
        }
      });
      console.log('🧪 [TEST] Voto creado:', newVote);
    }
    
    // Verificar el resultado
    const allVotes = await prisma.vote.findMany({
      where: { escrutinioId },
      include: { candidate: true }
    });
    
    console.log('🧪 [TEST] Todos los votos en el escrutinio:', allVotes);
    
    return NextResponse.json({
      success: true,
      data: {
        candidate,
        allVotes: allVotes.map(v => ({
          id: v.id,
          count: v.count,
          candidate: {
            id: v.candidate.id,
            name: v.candidate.name,
            party: v.candidate.party,
            number: v.candidate.number,
            electionLevel: v.candidate.electionLevel
          }
        }))
      }
    });
    
  } catch (error: any) {
    console.error('❌ [TEST] Error creando voto de prueba:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 }
    );
  }
}
