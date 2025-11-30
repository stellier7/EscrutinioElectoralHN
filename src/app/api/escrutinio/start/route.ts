import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { SimpleRateLimiter } from '@/lib/rate-limiter';
import { withDatabaseRetry, isDatabaseConnectionError, isUniqueConstraintError, formatDatabaseError } from '@/lib/db-operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  mesaNumber: z.string().min(1),
  electionLevel: z.enum(['PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL']),
  gps: z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().optional() }),
});

export async function POST(request: Request) {
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

    // Rate limiting por rol de usuario
    const rateLimitResult = SimpleRateLimiter.checkLimit(payload.userId, payload.role);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ 
        success: false, 
        error: 'Límite de requests excedido. Intenta de nuevo más tarde.',
        rateLimitInfo: {
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime
        }
      }, { status: 429 });
    }

    const json = await request.json();
    console.log('🔍 [START API] Request body recibido:', JSON.stringify(json, null, 2));
    
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      console.error('❌ [START API] Error de validación:', JSON.stringify(parsed.error, null, 2));
      console.error('❌ [START API] Datos que fallaron:', JSON.stringify(json, null, 2));
      return NextResponse.json({ 
        success: false, 
        error: 'Payload inválido',
        details: parsed.error.errors 
      }, { status: 400 });
    }
    const { mesaNumber, electionLevel, gps } = parsed.data;

    // Debug GPS values
    console.log('📍 [START API] GPS values received:', {
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: gps.accuracy,
      isZero: gps.latitude === 0 && gps.longitude === 0
    });

    // Verificar que existe una sesión activa con retry logic
    const activeSession = await withDatabaseRetry(
      () => prisma.escrutinioSession.findFirst({
        where: { isActive: true }
      }),
      { 
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [START API] Error obteniendo sesión activa (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );

    if (!activeSession) {
      console.warn('⚠️ [START API] No hay sesión activa para el usuario:', payload.userId);
      return NextResponse.json({ 
        success: false, 
        error: 'No hay una sesión de escrutinio activa. Contacte al administrador para activar una sesión.' 
      }, { status: 400 });
    }

    console.log('✅ [START API] Sesión activa encontrada:', activeSession.id);

    // Pick the first active election; adjust as needed
    let election = await withDatabaseRetry(
      () => prisma.election.findFirst({ 
        where: { isActive: true }, 
        orderBy: { startDate: 'desc' } 
      }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [START API] Error obteniendo elección activa (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );

    if (!election) {
      console.log('ℹ️ [START API] No hay elección activa, creando una por defecto...');
      // Crear elección por defecto si no existe (para ambientes sin seed)
      try {
        election = await withDatabaseRetry(
          () => prisma.election.create({
            data: {
              name: 'Elección Activa',
              description: 'Generada automáticamente',
              startDate: new Date(),
              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              isActive: true,
            },
          }),
          {
            onRetry: (error, attempt, maxRetries) => {
              console.error(`❌ [START API] Error creando elección por defecto (intento ${attempt}/${maxRetries}):`, error.message);
            }
          }
        );
        console.log('✅ [START API] Elección por defecto creada:', election.id);
      } catch (electionError) {
        console.error('❌ [START API] Error crítico creando elección:', formatDatabaseError(electionError, 'crear elección'));
        throw electionError;
      }
    }

    // Ensure Mesa exists by number and is active; create placeholder if not exists
    // Usar select para evitar problemas con cargaElectoral si la migración no se ha ejecutado
    let mesa = await withDatabaseRetry(
      () => prisma.mesa.findFirst({ 
        where: { 
          number: mesaNumber,
          isActive: true 
        },
        select: {
          id: true,
          number: true,
          location: true,
          department: true,
          municipality: true,
          area: true,
          address: true,
          isActive: true,
          // No incluir cargaElectoral para evitar errores si la migración no se ha ejecutado
        }
      }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [START API] Error obteniendo mesa activa (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );

    if (!mesa) {
      // Verificar si existe pero está inactiva
      try {
        const inactiveMesa = await withDatabaseRetry(
          () => prisma.mesa.findUnique({ 
            where: { number: mesaNumber },
            select: {
              id: true,
              number: true,
              isActive: true,
            }
          }),
          {
            onRetry: (error, attempt, maxRetries) => {
              console.error(`❌ [START API] Error verificando mesa inactiva (intento ${attempt}/${maxRetries}):`, error.message);
            }
          }
        );
        
        if (inactiveMesa) {
          console.warn(`⚠️ [START API] Mesa ${mesaNumber} existe pero está inactiva`);
          return NextResponse.json({ 
            success: false, 
            error: `La JRV ${mesaNumber} no está disponible en la sesión actual. Contacte al administrador.` 
          }, { status: 400 });
        }
      } catch (checkError) {
        console.error('❌ [START API] Error verificando si mesa existe:', formatDatabaseError(checkError, 'verificar mesa'));
        // Continuar para crear placeholder si no podemos verificar
      }
      
      // Crear placeholder solo si no existe
      console.log(`ℹ️ [START API] Creando placeholder para mesa ${mesaNumber}`);
      try {
        mesa = await withDatabaseRetry(
          () => prisma.mesa.create({ 
            data: { 
              number: mesaNumber, 
              location: `JRV ${mesaNumber} - Ubicación por definir`,
              department: 'Departamento por definir',
              isActive: true
            } 
          }),
          {
            onRetry: (error, attempt, maxRetries) => {
              console.error(`❌ [START API] Error creando placeholder de mesa (intento ${attempt}/${maxRetries}):`, error.message);
            }
          }
        );
        console.log('✅ [START API] Placeholder de mesa creado:', mesa.id);
      } catch (createError: any) {
        // Si es error de constraint único, intentar obtener la mesa nuevamente
        if (isUniqueConstraintError(createError)) {
          console.log('ℹ️ [START API] Mesa ya existe (unique constraint), obteniendo...');
          mesa = await withDatabaseRetry(
            () => prisma.mesa.findUnique({
              where: { number: mesaNumber },
              select: {
                id: true,
                number: true,
                location: true,
                department: true,
                municipality: true,
                area: true,
                address: true,
                isActive: true,
              }
            }) as Promise<typeof mesa>
          );
          if (!mesa) {
            throw new Error('No se pudo crear ni obtener la mesa');
          }
        } else {
          throw createError;
        }
      }
    }

    // If already exists for this user/session/mesa/level, reuse it (update location)
    const existing = await withDatabaseRetry(
      () => prisma.escrutinio.findFirst({
        where: {
          userId: payload.userId,
          sessionId: activeSession.id,
          mesaId: mesa.id,
          electionLevel: electionLevel as any,
          status: { in: ['PENDING', 'IN_PROGRESS'] }, // ← SOLO activos
        },
      }),
      {
        onRetry: (error, attempt, maxRetries) => {
          console.error(`❌ [START API] Error buscando escrutinio existente (intento ${attempt}/${maxRetries}):`, error.message);
        }
      }
    );

    let escrutinioId: string;
    if (existing) {
      console.log('📍 [START API] Updating existing escrutinio with GPS:', {
        escrutinioId: existing.id,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy
      });
      const updated = await withDatabaseRetry(
        () => prisma.escrutinio.update({
          where: { id: existing.id },
          data: { latitude: gps.latitude, longitude: gps.longitude, locationAccuracy: gps.accuracy },
        }),
        {
          onRetry: (error, attempt, maxRetries) => {
            console.error(`❌ [START API] Error actualizando escrutinio existente (intento ${attempt}/${maxRetries}):`, error.message);
          }
        }
      );
      escrutinioId = updated.id;
      console.log('✅ [START API] Escrutinio actualizado exitosamente:', escrutinioId);
    } else {
      console.log('📍 [START API] Creating new escrutinio with GPS:', {
        userId: payload.userId,
        mesaId: mesa.id,
        electionLevel,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy
      });
      const created = await withDatabaseRetry(
        () => prisma.escrutinio.create({
          data: {
            userId: payload.userId,
            electionId: election.id,
            sessionId: activeSession.id,
            mesaId: mesa.id,
            electionLevel: electionLevel as any,
            latitude: gps.latitude,
            longitude: gps.longitude,
            locationAccuracy: gps.accuracy,
            status: 'PENDING', // Escrutinio iniciado, en progreso
            isCompleted: false,
          },
        }),
        {
          onRetry: (error, attempt, maxRetries) => {
            console.error(`❌ [START API] Error creando nuevo escrutinio (intento ${attempt}/${maxRetries}):`, error.message);
          }
        }
      );
      escrutinioId = created.id;
      console.log('✅ [START API] Nuevo escrutinio creado exitosamente:', escrutinioId);
    }

    return NextResponse.json({ success: true, data: { escrutinioId } });
  } catch (error: any) {
    // Log detailed error information for debugging
    console.error('❌ [START API] Error crítico en POST /api/escrutinio/start:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      meta: error?.meta,
      userId: payload?.userId,
      mesaNumber,
      electionLevel,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (error instanceof Error) {
      // Database connection errors - return 503 Service Unavailable
      if (isDatabaseConnectionError(error)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Error de conexión con la base de datos. Por favor, intenta de nuevo en unos momentos.',
          details: formatDatabaseError(error, 'iniciar escrutinio')
        }, { status: 503 });
      }

      // Unique constraint violation - return 409 Conflict
      if (isUniqueConstraintError(error)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Ya existe un escrutinio activo para esta combinación de usuario, mesa y nivel.',
          details: formatDatabaseError(error, 'escrutinio duplicado')
        }, { status: 409 });
      }

      // Validation errors from Prisma - return 400 Bad Request
      if (error.message.includes('Invalid') || error.message.includes('invalid') || error.code?.startsWith('P2')) {
        return NextResponse.json({ 
          success: false, 
          error: 'Error en los datos proporcionados. Verifica que todos los campos sean válidos.',
          details: formatDatabaseError(error, 'validación de datos')
        }, { status: 400 });
      }

      // Rate limit errors (shouldn't reach here, but handle just in case)
      if (error.message.includes('rate limit') || error.message.includes('Límite')) {
        return NextResponse.json({ 
          success: false, 
          error: error.message || 'Límite de requests excedido. Intenta de nuevo más tarde.'
        }, { status: 429 });
      }
    }

    // Generic error response
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Error interno del servidor. Por favor, intenta de nuevo.',
      details: process.env.NODE_ENV === 'development' ? formatDatabaseError(error, 'error genérico') : undefined
    }, { status: 500 });
  }
}

