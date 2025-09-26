import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    const escrutinioId = params.id;
    const existing = await prisma.escrutinio.findUnique({ where: { id: escrutinioId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });

    // Obtener datos del cuerpo de la petición (opcional)
    let originalData = null;
    try {
      const body = await request.json();
      originalData = body.originalData;
      console.log('📊 [COMPLETE] Recibido originalData:', originalData);
    } catch (error) {
      // Si no hay cuerpo JSON, continuar sin originalData
      console.log('📊 [COMPLETE] No se recibió originalData');
    }

    await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: { 
        isCompleted: true, 
        completedAt: new Date(), 
        status: 'COMPLETED',
        ...(originalData && { originalData: originalData })
      },
    });

    console.log('📊 [COMPLETE] Escrutinio completado con originalData:', !!originalData);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}


