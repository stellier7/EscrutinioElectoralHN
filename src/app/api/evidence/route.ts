import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mesaNumber = searchParams.get('mesaNumber');
    const level = searchParams.get('level') as 'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL' | null;

    let mesaId: string | undefined;
    if (mesaNumber) {
      const mesa = await prisma.mesa.findUnique({ where: { number: mesaNumber } });
      if (!mesa) return NextResponse.json({ success: true, data: [] });
      mesaId = mesa.id;
    }

    const where: any = { actaImageUrl: { not: null } };
    if (mesaId) where.mesaId = mesaId;
    if (level) where.electionLevel = level;

    const escrutinios = await prisma.escrutinio.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      include: {
        mesa: true,
        election: true,
      },
    });

    const data = escrutinios.map((e) => ({
      escrutinioId: e.id,
      mesaNumber: e.mesa.number,
      electionLevel: e.electionLevel,
      url: e.actaImageUrl!,
      hash: e.actaImageHash || undefined,
      completedAt: e.completedAt?.toISOString() || e.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Error cargando evidencia' }, { status: 500 });
  }
}


