import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { AuditLogger } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/admin/sessions/[id]/activate - Activar una sesión específica
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    
    const payload = AuthUtils.verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const sessionId = params.id;

    // Verificar que la sesión existe
    const session = await prisma.escrutinioSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    if (session.isClosed) {
      return NextResponse.json(
        { success: false, error: 'No se puede activar una sesión cerrada' },
        { status: 400 }
      );
    }

    if (session.isActive) {
      return NextResponse.json(
        { success: false, error: 'La sesión ya está activa' },
        { status: 400 }
      );
    }

    // Verificar si hay otra sesión activa
    const activeSession = await prisma.escrutinioSession.findFirst({
      where: { 
        isActive: true,
        id: { not: sessionId }
      }
    });

    if (activeSession) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Ya existe una sesión activa: "${activeSession.name}". Debe cerrarla antes de activar esta sesión.` 
        },
        { status: 400 }
      );
    }

    // Usar transacción para asegurar consistencia
    const result = await prisma.$transaction(async (tx) => {
      // Desactivar cualquier otra sesión activa (por seguridad)
      await tx.escrutinioSession.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // Activar la sesión solicitada
      const updatedSession = await tx.escrutinioSession.update({
        where: { id: sessionId },
        data: { 
          isActive: true,
          startedAt: new Date() // Actualizar timestamp de inicio
        }
      });

      return updatedSession;
    });

    // Registrar en audit log
    await AuditLogger.log(
      'ACTIVATE_SESSION',
      `Sesión activada: ${result.name}`,
      payload.userId,
      {
        sessionId: result.id,
        sessionName: result.name
      }
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Sesión "${result.name}" activada exitosamente`
    });

  } catch (error: any) {
    console.error('Error activating session:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
