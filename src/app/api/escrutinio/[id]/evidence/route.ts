import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('📸 Evidence API called for escrutinio:', params.id);
    
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    const escrutinioId = params.id;
    const { publicUrl, hash } = (await request.json()) as { publicUrl: string; hash?: string };
    
    console.log('📸 Evidence data received:', { publicUrl, hash });
    
    if (!publicUrl) return NextResponse.json({ success: false, error: 'publicUrl requerido' }, { status: 400 });

    console.log('📸 Saving evidence to database...');
    await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: { actaImageUrl: publicUrl, actaImageHash: hash },
    });

    console.log('📸 Evidence saved successfully');
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('📸 Error saving evidence:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error guardando evidencia' }, { status: 500 });
  }
}


