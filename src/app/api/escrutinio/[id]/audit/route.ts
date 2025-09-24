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
    // Como details es un campo JSON, necesitamos obtener todos los logs y filtrar
    const allAuditLogs = await prisma.auditLog.findMany({
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
        timestamp: 'desc',
      },
    });

    // Filtrar logs que contengan el escrutinioId en los metadata
    const filteredLogs = allAuditLogs.filter(log => {
      const metadata = log.metadata as any;
      return metadata?.escrutinioId === escrutinioId;
    });

    return NextResponse.json({
      success: true,
      auditLogs: filteredLogs.map(log => ({
        id: log.id,
        action: log.action,
        metadata: log.metadata,
        timestamp: log.timestamp,
        user: log.user,
        ipAddress: log.ipAddress,
      })),
    });
  } catch (e: any) {
    console.error('Error obteniendo logs de auditoría:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
