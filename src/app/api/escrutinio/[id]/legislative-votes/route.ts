import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { z } from 'zod';

const LegislativeVoteDeltaSchema = z.object({
  partyId: z.string().min(1),
  casillaNumber: z.number().int().min(1).max(100),
  delta: z.number().int().min(-1000).max(1000),
  timestamp: z.number(),
  clientBatchId: z.string().min(1),
});

const LegislativeVotePayloadSchema = z.object({
  escrutinioId: z.string().min(1),
  votes: z.array(LegislativeVoteDeltaSchema),
  gps: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
    })
    .optional(),
  deviceId: z.string().optional(),
  audit: z.any().array().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('📥 [LEGISLATIVE-VOTES] Request received for escrutinio:', params.id);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      console.error('❌ [LEGISLATIVE-VOTES] No token provided');
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      console.error('❌ [LEGISLATIVE-VOTES] Invalid token');
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const escrutinioId = params.id;
    const body = await request.json();
    
    console.log('📊 [LEGISLATIVE-VOTES] Body received:', { 
      votesCount: body.votes?.length, 
      escrutinioId: body.escrutinioId,
      hasGps: !!body.gps 
    });
    
    const parsed = LegislativeVotePayloadSchema.safeParse(body);
    if (!parsed.success) {
      console.error('❌ [LEGISLATIVE-VOTES] Validation error:', parsed.error.errors);
      return NextResponse.json(
        { success: false, error: 'Payload inválido', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { votes, gps, deviceId, audit } = parsed.data;

    // Verificar que el escrutinio existe
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: { election: true }
    });

    if (!escrutinio) {
      console.error('❌ [LEGISLATIVE-VOTES] Escrutinio not found:', escrutinioId);
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    if (escrutinio.electionLevel !== 'LEGISLATIVE') {
      console.error('❌ [LEGISLATIVE-VOTES] Wrong election level:', escrutinio.electionLevel);
      return NextResponse.json(
        { success: false, error: 'Este endpoint es solo para escrutinios legislativos' },
        { status: 400 }
      );
    }

    console.log('✅ [LEGISLATIVE-VOTES] Escrutinio validated, processing', votes.length, 'votes');

    // Procesar cada voto
    await prisma.$transaction(async (tx) => {
      for (const v of votes) {
        // Buscar o crear candidato legislativo
        let candidate = await tx.candidate.findFirst({
          where: {
            electionId: escrutinio.electionId,
            number: v.casillaNumber,
            party: v.partyId,
            electionLevel: 'LEGISLATIVE'
          }
        });

        if (!candidate) {
          // Crear candidato si no existe
          console.log('➕ [LEGISLATIVE-VOTES] Creating new candidate:', v.partyId, v.casillaNumber);
          candidate = await tx.candidate.create({
            data: {
              name: `Diputado ${v.casillaNumber}`,
              party: v.partyId,
              number: v.casillaNumber,
              electionId: escrutinio.electionId,
              electionLevel: 'LEGISLATIVE',
              isActive: true
            }
          });
        }

        // Buscar voto existente
        const existing = await tx.vote.findUnique({
          where: { 
            escrutinioId_candidateId: { 
              escrutinioId, 
              candidateId: candidate.id 
            } 
          },
        });

        if (!existing) {
          // Crear nuevo voto
          const newCount = Math.max(0, v.delta);
          console.log('➕ [LEGISLATIVE-VOTES] Creating new vote:', v.partyId, v.casillaNumber, 'count:', newCount);
          await tx.vote.create({
            data: { 
              escrutinioId, 
              candidateId: candidate.id, 
              count: newCount
            },
          });
        } else {
          // Actualizar voto existente
          const newCount = Math.max(0, existing.count + v.delta);
          console.log('🔄 [LEGISLATIVE-VOTES] Updating vote:', v.partyId, v.casillaNumber, 'from', existing.count, 'to', newCount);
          await tx.vote.update({
            where: { id: existing.id },
            data: { count: newCount },
          });
        }
      }
    });

    console.log('✅ [LEGISLATIVE-VOTES] Successfully processed', votes.length, 'votes');

    return NextResponse.json({ 
      success: true, 
      data: { 
        updated: votes.length,
        escrutinioId,
        timestamp: Date.now()
      } 
    });

  } catch (error: any) {
    console.error('❌ [LEGISLATIVE-VOTES] Error processing legislative votes:', error);
    console.error('❌ [LEGISLATIVE-VOTES] Error stack:', error?.stack);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' }, 
      { status: 500 }
    );
  }
}
