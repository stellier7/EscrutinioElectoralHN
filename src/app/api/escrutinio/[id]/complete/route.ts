import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { withDatabaseRetry, isDatabaseConnectionError, formatDatabaseError } from '@/lib/db-operations';

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
    
    // Verificar que el escrutinio existe con retry logic
    const existing = await withDatabaseRetry(
      () => prisma.escrutinio.findUnique({ where: { id: escrutinioId } }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [COMPLETE API] Error obteniendo escrutinio (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );
    
    if (!existing) {
      console.warn('⚠️ [COMPLETE API] Escrutinio no encontrado:', escrutinioId);
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }

    // Obtener datos del cuerpo de la petición (opcional)
    let originalData = null;
    try {
      const body = await request.json();
      originalData = body.originalData;
      console.log('📊 [COMPLETE API] Recibido originalData:', !!originalData);
    } catch (error) {
      // Si no hay cuerpo JSON, continuar sin originalData
      console.log('ℹ️ [COMPLETE API] No se recibió originalData en el cuerpo');
    }

    // Actualizar escrutinio con retry logic
    await withDatabaseRetry(
      () => prisma.escrutinio.update({
        where: { id: escrutinioId },
        data: { 
          isCompleted: true, 
          completedAt: new Date(), 
          status: 'COMPLETED',
          ...(originalData && { originalData: originalData })
        },
      }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [COMPLETE API] Error completando escrutinio (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );

    console.log('✅ [COMPLETE API] Escrutinio completado exitosamente:', {
      escrutinioId,
      hasOriginalData: !!originalData,
      userId: payload.userId
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Log detailed error information
    console.error('❌ [COMPLETE API] Error crítico completando escrutinio:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      escrutinioId: params?.id,
      userId: payload?.userId,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (isDatabaseConnectionError(error)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Error de conexión con la base de datos. Por favor, intenta de nuevo en unos momentos.',
          details: formatDatabaseError(error, 'completar escrutinio')
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


