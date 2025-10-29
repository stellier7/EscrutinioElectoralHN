import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('📸 [EVIDENCE API] Called for escrutinio:', params.id);
    
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      console.error('📸 [EVIDENCE API] No token provided');
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      console.error('📸 [EVIDENCE API] Invalid token');
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const escrutinioId = params.id;
    const body = await request.json();
    const { publicUrl, hash } = body as { publicUrl: string; hash?: string };
    
    console.log('📸 [EVIDENCE API] Evidence data received:', { 
      escrutinioId,
      hasPublicUrl: !!publicUrl,
      publicUrlLength: publicUrl?.length,
      publicUrlType: publicUrl?.startsWith('data:') ? 'dataUrl' : publicUrl?.startsWith('http') ? 'url' : 'unknown',
      hash: hash || 'none'
    });
    
    if (!publicUrl) {
      console.error('📸 [EVIDENCE API] No publicUrl provided');
      return NextResponse.json({ success: false, error: 'publicUrl requerido' }, { status: 400 });
    }

    // Verificar que el escrutinio existe antes de actualizar
    const existingEscrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      select: { id: true, actaImageUrl: true, userId: true }
    });

    if (!existingEscrutinio) {
      console.error('📸 [EVIDENCE API] Escrutinio no encontrado:', escrutinioId);
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }

    console.log('📸 [EVIDENCE API] Escrutinio encontrado:', {
      id: existingEscrutinio.id,
      hasExistingActa: !!existingEscrutinio.actaImageUrl,
      userId: existingEscrutinio.userId,
      requestUserId: payload.userId
    });

    console.log('📸 [EVIDENCE API] Saving evidence to database...');
    const updatedEscrutinio = await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: { actaImageUrl: publicUrl, actaImageHash: hash },
      select: { id: true, actaImageUrl: true }
    });

    console.log('📸 [EVIDENCE API] Evidence saved successfully:', {
      escrutinioId: updatedEscrutinio.id,
      actaImageUrl: updatedEscrutinio.actaImageUrl ? 'Presente' : 'Ausente',
      actaImageUrlLength: updatedEscrutinio.actaImageUrl?.length
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('📸 [EVIDENCE API] Error saving evidence:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error guardando evidencia' }, { status: 500 });
  }
}


