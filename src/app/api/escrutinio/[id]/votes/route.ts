import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { SimpleRateLimiter } from '@/lib/rate-limiter';

export const runtime = 'nodejs';

const VoteDeltaSchema = z.object({
  candidateId: z.string().min(1),
  delta: z.number().int().min(-1000).max(1000),
  timestamp: z.number(),
  clientBatchId: z.string(),
});

const BodySchema = z.object({
  escrutinioId: z.string().min(1),
  votes: z.array(VoteDeltaSchema).min(1),
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

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

    // Rate limiting por rol de usuario
    const rateLimitResult = SimpleRateLimiter.checkLimit(payload.userId, payload.role);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ 
        success: false, 
        error: 'Límite de requests excedido. Intenta de nuevo más tarde.',
        rateLimitInfo: {
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime
        }
      }, { status: 429 });
    }

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Payload inválido' }, { status: 400 });
    }

    const { escrutinioId, votes } = parsed.data;
    if (params.id !== escrutinioId) {
      return NextResponse.json({ success: false, error: 'ID inconsistente' }, { status: 400 });
    }

    // Validate escrutinio exists to avoid FK errors
    const escrutinio = await prisma.escrutinio.findUnique({ where: { id: escrutinioId } });
    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado. Inicie el escrutinio antes de registrar votos.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const v of votes) {
        // Resolve candidateId: accept either real candidate ID or candidate number
        let resolvedCandidateId = v.candidateId;

        // Try direct ID first
        let candidate = await tx.candidate.findUnique({ where: { id: resolvedCandidateId } });
        if (!candidate) {
          // If not found and looks numeric, map by (electionId, number, level)
          const asNumber = Number(v.candidateId);
          if (!Number.isNaN(asNumber)) {
            candidate = await tx.candidate.findUnique({
              where: {
                electionId_number_electionLevel: {
                  electionId: escrutinio.electionId,
                  number: asNumber,
                  electionLevel: escrutinio.electionLevel,
                },
              },
            });
            if (candidate) {
              resolvedCandidateId = candidate.id;
            }
          }
        }

        if (!candidate) {
          // Auto-create placeholder candidate when numeric code provided but not present in DB
          const asNumber = Number(v.candidateId);
          if (!Number.isNaN(asNumber)) {
            candidate = await tx.candidate.create({
              data: {
                name: `Candidato ${asNumber}`,
                party: 'N/A',
                number: asNumber,
                electionId: escrutinio.electionId,
                electionLevel: escrutinio.electionLevel,
                isActive: true,
              },
            });
            resolvedCandidateId = candidate.id;
          } else {
            return NextResponse.json({ success: false, error: `Candidato no encontrado para '${v.candidateId}'` }, { status: 400 });
          }
        }

        const existing = await tx.vote.findUnique({
          where: { escrutinioId_candidateId: { escrutinioId, candidateId: resolvedCandidateId } },
        });

        if (!existing) {
          await tx.vote.create({
            data: { escrutinioId, candidateId: resolvedCandidateId, count: Math.max(0, v.delta) },
          });
        } else {
          await tx.vote.update({
            where: { id: existing.id },
            data: { count: Math.max(0, existing.count + v.delta) },
          });
        }
      }
    });

    return NextResponse.json({ success: true, data: { updated: votes.length } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Error interno' }, { status: 500 });
  }
}

