import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    const escrutinioId = params.id;
    const { publicUrl, hash } = (await request.json()) as { publicUrl: string; hash?: string };
    if (!publicUrl) return NextResponse.json({ success: false, error: 'publicUrl requerido' }, { status: 400 });

    await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: { actaImageUrl: publicUrl, actaImageHash: hash },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Error guardando evidencia' }, { status: 500 });
  }
}


