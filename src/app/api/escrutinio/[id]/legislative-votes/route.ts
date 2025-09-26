import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const escrutinioId = params.id;
    const body = await request.json();
    
    const parsed = LegislativeVotePayloadSchema.safeParse(body);
    if (!parsed.success) {
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
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    if (escrutinio.electionLevel !== 'LEGISLATIVE') {
      return NextResponse.json(
        { success: false, error: 'Este endpoint es solo para escrutinios legislativos' },
        { status: 400 }
      );
    }

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
          await tx.vote.create({
            data: { 
              escrutinioId, 
              candidateId: candidate.id, 
              count: Math.max(0, v.delta) 
            },
          });
        } else {
          // Actualizar voto existente
          await tx.vote.update({
            where: { id: existing.id },
            data: { count: Math.max(0, existing.count + v.delta) },
          });
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: { 
        updated: votes.length,
        escrutinioId,
        timestamp: Date.now()
      } 
    });

  } catch (error: any) {
    console.error('Error processing legislative votes:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' }, 
      { status: 500 }
    );
  }
}
