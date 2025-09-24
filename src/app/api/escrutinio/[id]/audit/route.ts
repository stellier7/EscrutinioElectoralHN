import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    const escrutinioId = params.id;

    // Verificar que el escrutinio existe
    const escrutinio = await prisma.escrutinio.findUnique({ where: { id: escrutinioId } });
    if (!escrutinio) return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });

    // Obtener logs de auditoría relacionados con este escrutinio
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        details: {
          path: ['escrutinioId'],
          equals: escrutinioId,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filtrar logs que contengan el escrutinioId en los detalles
    const filteredLogs = auditLogs.filter(log => {
      const details = log.details as any;
      return details?.escrutinioId === escrutinioId;
    });

    return NextResponse.json({
      success: true,
      auditLogs: filteredLogs.map(log => ({
        id: log.id,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
        user: log.user,
        ipAddress: log.ipAddress,
      })),
    });
  } catch (e: any) {
    console.error('Error obteniendo logs de auditoría:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
