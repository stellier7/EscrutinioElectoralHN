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
    
    // Solo admins pueden ocultar ubicaciones
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden ocultar ubicaciones' }, { status: 403 });
    }

    const escrutinioId = params.id;
    const { reason } = await request.json();
    
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'La razón es requerida' }, { status: 400 });
    }

    // Verificar que el escrutinio existe
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      include: { mesa: true }
    });
    
    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }

    // Actualizar campos de privacidad
    await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: {
        gpsHidden: true,
        gpsHiddenReason: reason.trim(),
        gpsHiddenBy: payload.userId,
        gpsHiddenAt: new Date()
      }
    });

    // Crear log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'HIDE_GPS',
        description: `Ubicación GPS oculta para escrutinio JRV ${escrutinio.mesa.number}. Razón: ${reason}`,
        metadata: {
          escrutinioId,
          mesaNumber: escrutinio.mesa.number,
          reason: reason.trim(),
          timestamp: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Ubicación GPS oculta exitosamente' 
    });
  } catch (e: any) {
    console.error('Error ocultando GPS:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
