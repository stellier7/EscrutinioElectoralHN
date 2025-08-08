import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const mesas = await prisma.mesa.findMany({ orderBy: { number: 'asc' } });
    const data = mesas.map((m) => ({ id: m.id, number: m.number, location: m.location, address: m.address }));
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Error cargando mesas' }, { status: 500 });
  }
}


