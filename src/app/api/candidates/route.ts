import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') as 'PRESIDENTIAL' | 'LEGISLATIVE' | 'MUNICIPAL' | null;

    // Buscar la elección "Elecciones Generales Honduras 2025" específicamente
    let election = await prisma.election.findFirst({ 
      where: { 
        isActive: true,
        name: { contains: 'Elecciones Generales' }
      }, 
      orderBy: { startDate: 'desc' } 
    });
    
    // Si no encuentra esa específica, tomar la primera activa
    if (!election) {
      election = await prisma.election.findFirst({ 
        where: { isActive: true }, 
        orderBy: { startDate: 'desc' } 
      });
    }
    
    if (!election) return NextResponse.json({ success: true, data: [] });

    const where: any = { electionId: election.id, isActive: true };
    if (level) where.electionLevel = level;

    const candidates = await prisma.candidate.findMany({ where, orderBy: [{ electionLevel: 'asc' }, { number: 'asc' }] });
    const data = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      party: c.party,
      number: c.number,
      electionLevel: c.electionLevel,
    }));

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Error cargando candidatos' }, { status: 500 });
  }
}

