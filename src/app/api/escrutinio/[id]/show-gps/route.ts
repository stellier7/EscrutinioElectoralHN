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
    
    // Solo admins pueden mostrar ubicaciones
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden mostrar ubicaciones' }, { status: 403 });
    }

    const escrutinioId = params.id;

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
        gpsHidden: false,
        gpsHiddenReason: null,
        gpsHiddenBy: null,
        gpsHiddenAt: null
      }
    });

    // Crear log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'SHOW_GPS',
        description: `Ubicación GPS mostrada para escrutinio JRV ${escrutinio.mesa.number}`,
        metadata: {
          escrutinioId,
          mesaNumber: escrutinio.mesa.number,
          timestamp: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Ubicación GPS mostrada exitosamente' 
    });
  } catch (e: any) {
    console.error('Error mostrando GPS:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
