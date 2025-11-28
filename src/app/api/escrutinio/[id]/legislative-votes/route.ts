import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { z } from 'zod';

const LegislativeVoteDeltaSchema = z.object({
  partyId: z.string().min(1),
  casillaNumber: z.number().int().min(0).max(100), // Permitir 0 para blanco/nulo
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
    console.log('📥 [VOTOS-LEGISLATIVOS] Solicitud recibida para escrutinio:', params.id);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      console.error('❌ [VOTOS-LEGISLATIVOS] No se proporcionó token');
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      console.error('❌ [VOTOS-LEGISLATIVOS] Token inválido');
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const escrutinioId = params.id;
    const body = await request.json();
    
    console.log('📊 [VOTOS-LEGISLATIVOS] Cuerpo recibido:', { 
      votesCount: body.votes?.length, 
      escrutinioId: body.escrutinioId,
      hasGps: !!body.gps 
    });
    
    const parsed = LegislativeVotePayloadSchema.safeParse(body);
    if (!parsed.success) {
      console.error('❌ [VOTOS-LEGISLATIVOS] Error de validación:', parsed.error.errors);
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
      console.error('❌ [VOTOS-LEGISLATIVOS] Escrutinio no encontrado:', escrutinioId);
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    if (escrutinio.electionLevel !== 'LEGISLATIVE') {
      console.error('❌ [VOTOS-LEGISLATIVOS] Nivel de elección incorrecto:', escrutinio.electionLevel);
      return NextResponse.json(
        { success: false, error: 'Este endpoint es solo para escrutinios legislativos' },
        { status: 400 }
      );
    }

    console.log('✅ [VOTOS-LEGISLATIVOS] Escrutinio validado, procesando', votes.length, 'votos');

    // Procesar cada voto
    await prisma.$transaction(async (tx) => {
      for (const v of votes) {
        // Manejar votos blanco/nulo (partyId: BLANK o NULL, casillaNumber: 0)
        if (v.partyId === 'BLANK' || v.partyId === 'NULL') {
          const specialCandidateName = v.partyId === 'BLANK' ? 'Voto en Blanco' : 'Voto Nulo';
          const specialCandidateNumber = v.partyId === 'BLANK' ? 999 : 998;
          
          // Buscar o crear candidato especial
          let candidate = await tx.candidate.findFirst({
            where: {
              electionId: escrutinio.electionId,
              name: specialCandidateName,
              party: v.partyId,
              electionLevel: 'LEGISLATIVE'
            }
          });

          if (!candidate) {
            console.log('➕ [VOTOS-LEGISLATIVOS] Creando candidato especial:', specialCandidateName);
            candidate = await tx.candidate.create({
              data: {
                name: specialCandidateName,
                party: v.partyId,
                number: specialCandidateNumber,
                electionId: escrutinio.electionId,
                electionLevel: 'LEGISLATIVE',
                isActive: true
              }
            });
          }

          // Buscar voto existente
          const existing = await tx.vote.findFirst({
            where: { 
              escrutinioId: escrutinioId,
              candidateId: candidate.id
            },
          });

          if (!existing) {
            // Crear nuevo voto
            const newCount = Math.max(0, v.delta);
            console.log('➕ [VOTOS-LEGISLATIVOS] Creando nuevo voto especial:', v.partyId, 'conteo:', newCount);
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
            console.log('🔄 [VOTOS-LEGISLATIVOS] Actualizando voto especial:', v.partyId, 'de', existing.count, 'a', newCount);
            await tx.vote.update({
              where: { id: existing.id },
              data: { count: newCount },
            });
          }
        } else {
          // Procesar votos normales (partidos con casillas)
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
            console.log('➕ [VOTOS-LEGISLATIVOS] Creando nuevo candidato:', v.partyId, v.casillaNumber);
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
          const existing = await tx.vote.findFirst({
            where: { 
              escrutinioId: escrutinioId,
              candidateId: candidate.id
            },
          });

          if (!existing) {
            // Crear nuevo voto
            const newCount = Math.max(0, v.delta);
            console.log('➕ [VOTOS-LEGISLATIVOS] Creando nuevo voto:', v.partyId, v.casillaNumber, 'conteo:', newCount);
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
            console.log('🔄 [VOTOS-LEGISLATIVOS] Actualizando voto:', v.partyId, v.casillaNumber, 'de', existing.count, 'a', newCount);
            await tx.vote.update({
              where: { id: existing.id },
              data: { count: newCount },
            });
          }
        }
      }
    });

    console.log('✅ [VOTOS-LEGISLATIVOS] Procesados exitosamente', votes.length, 'votos');

    return NextResponse.json({ 
      success: true, 
      data: { 
        updated: votes.length,
        escrutinioId,
        timestamp: Date.now()
      } 
    });

  } catch (error: any) {
    console.error('❌ [VOTOS-LEGISLATIVOS] Error procesando votos legislativos:', error);
    console.error('❌ [VOTOS-LEGISLATIVOS] Stack de error:', error?.stack);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' }, 
      { status: 500 }
    );
  }
}
