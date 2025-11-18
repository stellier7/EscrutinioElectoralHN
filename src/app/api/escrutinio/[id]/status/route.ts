import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const escrutinioId = params.id;

    // Buscar el escrutinio
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      select: {
        id: true,
        status: true,
        userId: true,
        mesa: {
          select: {
            id: true,
            number: true,
            // cargaElectoral se obtendrá después si existe
          }
        }
      }
    });

    if (!escrutinio) {
      return NextResponse.json(
        { success: false, error: 'Escrutinio no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que el usuario tenga acceso al escrutinio
    if (payload.role !== 'ADMIN' && escrutinio.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para acceder a este escrutinio' },
        { status: 403 }
      );
    }

    // Intentar obtener cargaElectoral de forma segura usando $queryRaw
    let cargaElectoral: number | null = null;
    try {
      const result = await prisma.$queryRaw<Array<{ cargaElectoral: number | null }>>`
        SELECT "cargaElectoral" FROM "Mesa" WHERE id = ${escrutinio.mesa.id}
      `.catch(() => null);
      cargaElectoral = result?.[0]?.cargaElectoral ?? null;
    } catch (error) {
      // Si falla, cargaElectoral permanece null (columna puede no existir aún)
      console.warn('⚠️ [STATUS API] No se pudo obtener cargaElectoral (columna puede no existir aún):', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: escrutinio.id,
        status: escrutinio.status,
        mesaNumber: escrutinio.mesa.number,
        cargaElectoral: cargaElectoral
      }
    });

  } catch (error) {
    console.error('Error fetching escrutinio status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
