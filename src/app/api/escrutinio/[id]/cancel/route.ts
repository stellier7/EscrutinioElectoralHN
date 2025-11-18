import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Force redeploy for cancel endpoint

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    console.log('🔄 Cancel endpoint called with ID:', params.id);
    console.log('🔄 Request headers:', Object.fromEntries(request.headers.entries()));
    
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      console.log('❌ No token provided');
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      console.log('❌ Invalid token');
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const escrutinioId = params.id;
    console.log('🔍 Looking for escrutinio:', escrutinioId);
    const existing = await prisma.escrutinio.findUnique({ 
      where: { id: escrutinioId },
      include: { 
        mesa: {
          select: {
            id: true,
            number: true,
            location: true,
            department: true,
            municipality: true,
            area: true,
            address: true,
            isActive: true,
            // cargaElectoral no se necesita para cancel, evitar errores si la migración no se ha ejecutado
          }
        }
      }
    });
    
    if (!existing) {
      console.log('❌ Escrutinio no encontrado');
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }

    console.log('🔍 Escrutinio encontrado:', {
      id: existing.id,
      status: existing.status,
      completedAt: existing.completedAt,
      userId: existing.userId,
      payloadUserId: payload.userId,
      payloadRole: payload.role
    });

    // Solo el creador del escrutinio o un admin puede cancelarlo
    if (existing.userId !== payload.userId && payload.role !== 'ADMIN') {
      console.log('❌ No autorizado para cancelar este escrutinio');
      return NextResponse.json({ success: false, error: 'No autorizado para cancelar este escrutinio' }, { status: 403 });
    }

    // Permitir cancelar escrutinios en cualquier estado (más permisivo)
    // Solo no permitir si ya está en estado FAILED (ya cancelado)
    if (existing.status === 'FAILED') {
      console.log('❌ Escrutinio ya está cancelado - status:', existing.status);
      return NextResponse.json({ success: false, error: 'Este escrutinio ya fue cancelado' }, { status: 400 });
    }

    // Marcar escrutinio como cancelado (FAILED) en lugar de eliminarlo
    console.log('🔄 Iniciando transacción para marcar escrutinio como FAILED...');
    await prisma.$transaction(async (tx) => {
      console.log('🔄 Actualizando escrutinio en base de datos...');
      // Marcar escrutinio como cancelado
      await tx.escrutinio.update({
        where: { id: escrutinioId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log('✅ Escrutinio marcado como cancelado (FAILED)');
    });
    console.log('✅ Transacción completada');

    // Crear log de auditoría (opcional, no crítico)
    try {
      await prisma.auditLog.create({
        data: {
          userId: payload.userId,
          action: 'CANCEL_ESCRUTINIO',
          description: `Escrutinio cancelado para JRV ${existing.mesa?.number || 'N/A'}`,
          metadata: {
            escrutinioId,
            mesaNumber: existing.mesa?.number || null,
            electionLevel: existing.electionLevel,
            timestamp: new Date().toISOString(),
          },
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
      console.log('✅ Audit log creado');
    } catch (auditError) {
      console.log('⚠️ Error creando audit log (no crítico):', auditError);
      // No fallar la operación por un error de audit log
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error canceling escrutinio:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
