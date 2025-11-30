import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils, JWTPayload } from '@/lib/auth';
import { withDatabaseRetry, isDatabaseConnectionError, formatDatabaseError } from '@/lib/db-operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let payload: JWTPayload | null = null; // Declarar payload fuera del try para que esté disponible en el catch
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    const escrutinioId = params.id;
    
    // Obtener datos del cuerpo de la petición (opcional para escrutinios presidenciales)
    let partyCounts, appliedVotes, finalGps;
    try {
      const body = await request.json();
      partyCounts = body.partyCounts;
      appliedVotes = body.appliedVotes;
      finalGps = body.finalGps; // GPS final cuando se cierra el escrutinio
    } catch (error) {
      // Si no hay cuerpo JSON (escrutinio presidencial), usar valores por defecto
      console.log('📝 No se recibieron datos del cuerpo - escrutinio presidencial');
      partyCounts = null;
      appliedVotes = null;
      finalGps = null;
    }
    
    console.log('🔄 Cerrando escrutinio con datos:', { escrutinioId, partyCounts, appliedVotes, finalGps });
    
    // Debug GPS final
    if (finalGps) {
      console.log('📍 [CLOSE API] GPS final recibido:', {
        latitude: finalGps.latitude,
        longitude: finalGps.longitude,
        accuracy: finalGps.accuracy,
        isZero: finalGps.latitude === 0 && finalGps.longitude === 0
      });
    } else {
      console.log('📍 [CLOSE API] No se recibió GPS final');
    }
    const existing = await withDatabaseRetry(
      () => prisma.escrutinio.findUnique({ 
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
              // cargaElectoral no se necesita para close, evitar errores si la migración no se ha ejecutado
            }
          }
        }
      }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [CLOSE API] Error obteniendo escrutinio (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );
    
    if (!existing) {
      console.warn('⚠️ [CLOSE API] Escrutinio no encontrado:', escrutinioId);
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }
    
    console.log('📊 Estado actual del escrutinio:', {
      id: existing.id,
      status: existing.status,
      electionLevel: existing.electionLevel,
      mesaNumber: existing.mesa.number
    });

    // Permitir cerrar escrutinios que están COMPLETED, FAILED, o PENDING
    // Para escrutinios PENDING, los marcamos como COMPLETED automáticamente
    if (existing.status !== 'COMPLETED' && existing.status !== 'FAILED' && existing.status !== 'PENDING') {
      return NextResponse.json({ 
        success: false, 
        error: `No se puede cerrar este escrutinio. Estado actual: ${existing.status}` 
      }, { status: 400 });
    }

    // Si está PENDING, marcarlo como COMPLETED automáticamente
    if (existing.status === 'PENDING') {
      console.log('🔄 [CLOSE API] Marcando escrutinio PENDING como COMPLETED automáticamente');
      await withDatabaseRetry(
        () => prisma.escrutinio.update({
          where: { id: escrutinioId },
          data: { 
            status: 'COMPLETED',
            isCompleted: true,
            completedAt: new Date()
          }
        }),
        {
          onRetry: (error, attempt, maxRetries) => {
            console.error(`❌ [CLOSE API] Error marcando PENDING como COMPLETED (intento ${attempt}/${maxRetries}):`, error.message);
          }
        }
      );
    }

    // Cerrar automáticamente cualquier papeleta abierta antes de cerrar el escrutinio
    console.log('🔄 [CLOSE API] Cerrando papeletas abiertas antes de cerrar escrutinio...');
    const openPapeletas = await withDatabaseRetry(
      () => prisma.papeleta.findMany({
        where: {
          escrutinioId: escrutinioId,
          status: 'OPEN'
        }
      }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [CLOSE API] Error obteniendo papeletas abiertas (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );

    if (openPapeletas.length > 0) {
      console.log(`📄 Cerrando ${openPapeletas.length} papeletas abiertas`);
      
      // Si hay votos en appliedVotes, guardarlos en la papeleta abierta
      if (appliedVotes && Object.keys(appliedVotes).length > 0) {
        console.log('💾 Guardando votos en papeleta abierta:', appliedVotes);
        
        // Convertir appliedVotes a votesBuffer para la papeleta
        const votesBuffer: Array<{
          partyId: string;
          casillaNumber: number;
          timestamp: string;
        }> = [];
        Object.entries(appliedVotes).forEach(([partyId, casillas]: [string, any]) => {
          Object.entries(casillas).forEach(([casillaNumber, votes]: [string, any]) => {
            for (let i = 0; i < votes; i++) {
              votesBuffer.push({
                partyId,
                casillaNumber: parseInt(casillaNumber),
                timestamp: new Date().toISOString()
              });
            }
          });
        });
        
        console.log('📊 VotesBuffer generado:', votesBuffer);
        
        // Actualizar la papeleta abierta con los votos
        await withDatabaseRetry(
          () => prisma.papeleta.updateMany({
            where: {
              escrutinioId: escrutinioId,
              status: 'OPEN'
            },
            data: {
              status: 'CLOSED',
              closedAt: new Date(),
              votesBuffer: votesBuffer
            }
          }),
          {
            onRetry: (error, attempt, maxRetries) => {
              console.error(`❌ [CLOSE API] Error cerrando papeletas con votos (intento ${attempt}/${maxRetries}):`, error.message);
            }
          }
        );
      } else {
        // Solo cerrar sin votos
        await withDatabaseRetry(
          () => prisma.papeleta.updateMany({
            where: {
              escrutinioId: escrutinioId,
              status: 'OPEN'
            },
            data: {
              status: 'CLOSED',
              closedAt: new Date()
            }
          }),
          {
            onRetry: (error, attempt, maxRetries) => {
              console.error(`❌ [CLOSE API] Error cerrando papeletas sin votos (intento ${attempt}/${maxRetries}):`, error.message);
            }
          }
        );
      }
    }

    // Guardar versión original si es la primera vez que se cierra
    let originalData = null;
    if (!existing.hasEdits && partyCounts && appliedVotes) {
      // Obtener todas las papeletas cerradas para guardar como versión original
      const closedPapeletas = await withDatabaseRetry(
        () => prisma.papeleta.findMany({
          where: {
            escrutinioId: escrutinioId,
            status: 'CLOSED'
          }
        }),
        {
          onRetry: (error, attempt, maxRetries) => {
            console.error(`❌ [CLOSE API] Error obteniendo papeletas cerradas (intento ${attempt}/${maxRetries}):`, error.message);
          }
        }
      );
      
      originalData = {
        partyCounts,
        appliedVotes,
        papeletas: closedPapeletas.map(p => ({
          id: p.id,
          votesBuffer: p.votesBuffer,
          closedAt: p.closedAt
        })),
        timestamp: new Date().toISOString()
      };
      
      console.log('💾 Guardando versión original:', originalData);
    }

    // Actualizar status a CLOSED con GPS final
    const updateData: any = { 
      status: 'CLOSED',
      ...(originalData && { originalData: originalData })
    };
    
    // Agregar GPS final si está disponible
    if (finalGps && finalGps.latitude && finalGps.longitude) {
      updateData.finalLatitude = finalGps.latitude;
      updateData.finalLongitude = finalGps.longitude;
      updateData.finalLocationAccuracy = finalGps.accuracy || 0;
      
      console.log('📍 [CLOSE API] Guardando GPS final:', {
        finalLatitude: finalGps.latitude,
        finalLongitude: finalGps.longitude,
        finalLocationAccuracy: finalGps.accuracy || 0
      });
    }
    
    await withDatabaseRetry(
      () => prisma.escrutinio.update({
        where: { id: escrutinioId },
        data: updateData,
      }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [CLOSE API] Error actualizando escrutinio (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );

    // Crear log de auditoría (no crítico si falla, solo loguear)
    try {
      await withDatabaseRetry(
        () => prisma.auditLog.create({
          data: {
            userId: payload.userId,
            action: 'CLOSE_ESCRUTINIO',
            description: `Escrutinio cerrado para JRV ${existing.mesa.number}`,
            metadata: {
              escrutinioId,
              mesaNumber: existing.mesa.number,
              electionLevel: existing.electionLevel,
              timestamp: new Date().toISOString(),
            },
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        }),
        {
          maxRetries: 2, // Menos reintentos para auditoría (no crítico)
          onRetry: (error, attempt, maxRetries) => {
            console.warn(`⚠️ [CLOSE API] Error creando log de auditoría (intento ${attempt}/${maxRetries}):`, error.message);
          }
        }
      );
    } catch (auditError) {
      // No fallar si el log de auditoría falla, solo loguear
      console.warn('⚠️ [CLOSE API] No se pudo crear log de auditoría (continuando):', auditError);
    }

    console.log('✅ [CLOSE API] Escrutinio cerrado exitosamente:', {
      escrutinioId,
      mesaNumber: existing.mesa.number,
      electionLevel: existing.electionLevel,
      userId: payload.userId
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Log detailed error information
    console.error('❌ [CLOSE API] Error crítico cerrando escrutinio:', {
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
          details: formatDatabaseError(error, 'cerrar escrutinio')
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
