import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withDatabaseRetry, isDatabaseConnectionError, formatDatabaseError } from '@/lib/db-operations';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Checking active escrutinio for JRV:', params.id);
    
    // Autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const mesaNumber = params.id;

    // Buscar escrutinios activos para esta JRV
    // Los escrutinios activos son los que están en progreso (PENDING o IN_PROGRESS)
    // y que NO están completados (completedAt es null)
    const activeEscrutinios = await withDatabaseRetry(
      () => prisma.escrutinio.findMany({
        where: {
          mesa: {
            number: mesaNumber
          },
          status: {
            in: ['PENDING', 'IN_PROGRESS'] // Solo escrutinios en progreso
          },
          completedAt: null, // No completados
          isCompleted: false, // También verificar el flag isCompleted
        },
        include: {
          mesa: {
            select: {
              id: true,
              number: true,
              location: true,
              department: true,
              // No incluir cargaElectoral para evitar errores si la migración no se ha ejecutado
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [CHECK-ACTIVE API] Error buscando escrutinios activos (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );

    console.log('📊 [CHECK-ACTIVE API] Escrutinios activos encontrados:', activeEscrutinios.length);

    if (activeEscrutinios.length > 0) {
      const latestEscrutinio = activeEscrutinios[0];
      return NextResponse.json({
        success: true,
        hasActive: true,
        escrutinio: {
          id: latestEscrutinio.id,
          electionLevel: latestEscrutinio.electionLevel,
          createdAt: latestEscrutinio.createdAt,
          user: latestEscrutinio.user,
          mesaNumber: latestEscrutinio.mesa.number,
          mesaName: latestEscrutinio.mesa.location
        }
      });
    }

    return NextResponse.json({
      success: true,
      hasActive: false
    });

  } catch (error: any) {
    // Log detailed error information
    console.error('❌ [CHECK-ACTIVE API] Error crítico verificando escrutinio activo:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      mesaNumber: params?.id,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (isDatabaseConnectionError(error)) {
        return NextResponse.json({
          success: false,
          error: 'Error de conexión con la base de datos. Por favor, intenta de nuevo en unos momentos.',
          details: formatDatabaseError(error, 'verificar escrutinio activo')
        }, { status: 503 });
      }
    }

    return NextResponse.json({
      success: false,
      error: error?.message || 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? formatDatabaseError(error, 'error genérico') : undefined
    }, { status: 500 });
  }
}
