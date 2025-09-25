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
    const existing = await prisma.escrutinio.findUnique({ 
      where: { id: escrutinioId },
      include: { mesa: true }
    });
    
    if (!existing) return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });

    // Solo el creador del escrutinio o un admin puede cancelarlo
    if (existing.userId !== payload.userId && payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado para cancelar este escrutinio' }, { status: 403 });
    }

    // Solo se pueden cancelar escrutinios en progreso (COMPLETED sin finalizar)
    if (existing.status !== 'COMPLETED' || existing.completedAt !== null) {
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
