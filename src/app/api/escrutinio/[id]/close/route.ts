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

    // Solo permitir cerrar escrutinios que están COMPLETED
    if (existing.status !== 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Solo se pueden cerrar escrutinios completados' }, { status: 400 });
    }

    // Actualizar status a CLOSED
    await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: { status: 'CLOSED' },
    });

    // Crear log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CLOSE_ESCRUTINIO',
        metadata: {
          escrutinioId,
          mesaNumber: existing.mesaNumber,
          electionLevel: existing.electionLevel,
          timestamp: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error cerrando escrutinio:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
