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
      include: { mesa: true }
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

    // Solo se pueden cancelar escrutinios en progreso (COMPLETED sin finalizar)
    if (existing.status !== 'COMPLETED' || existing.completedAt !== null) {
      console.log('❌ Escrutinio no se puede cancelar - status:', existing.status, 'completedAt:', existing.completedAt);
      return NextResponse.json({ success: false, error: 'Solo se pueden cancelar escrutinios en progreso' }, { status: 400 });
    }

    // Eliminar todos los datos relacionados
    await prisma.$transaction(async (tx) => {
      // Eliminar votos
      await tx.vote.deleteMany({ where: { escrutinioId } });
      
      // Eliminar papeletas (los votos se almacenan en votesBuffer como JSON)
      await tx.papeleta.deleteMany({ where: { escrutinioId } });
      
      // Eliminar logs de auditoría
      await tx.auditLog.deleteMany({ 
        where: { 
          metadata: {
            path: ['escrutinioId'],
            equals: escrutinioId
          }
        } 
      });
      
      // Eliminar el escrutinio
      await tx.escrutinio.delete({ where: { id: escrutinioId } });
    });

    // Crear log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CANCEL_ESCRUTINIO',
        description: `Escrutinio cancelado para JRV ${existing.mesa.number}`,
        metadata: {
          escrutinioId,
          mesaNumber: existing.mesa.number,
          electionLevel: existing.electionLevel,
          timestamp: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error canceling escrutinio:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
