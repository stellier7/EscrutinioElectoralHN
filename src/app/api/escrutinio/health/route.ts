import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkDatabaseHealth } from '@/lib/db-health';
import { withDatabaseRetry } from '@/lib/db-operations';

export const dynamic = 'force-dynamic';

/**
 * Health check endpoint for escrutinio operations
 * Verifies critical dependencies are working:
 * - Database connection
 * - Active escrutinio session exists
 * - Active election exists
 */
export async function GET(request: NextRequest) {
  try {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {} as any,
      errors: [] as string[],
    };

    // 1. Database Connection Check
    try {
      console.log('🔍 [ESCRUTINIO HEALTH] Verificando conexión a base de datos...');
      const dbHealth = await checkDatabaseHealth();
      
      healthCheck.services.database = {
        status: dbHealth.isHealthy ? 'healthy' : 'unhealthy',
        responseTime: `${dbHealth.responseTime}ms`,
        error: dbHealth.error,
      };

      if (!dbHealth.isHealthy) {
        healthCheck.status = 'degraded';
        healthCheck.errors.push(`Database connection failed: ${dbHealth.error}`);
      }
    } catch (error) {
      console.error('❌ [ESCRUTINIO HEALTH] Error verificando base de datos:', error);
      healthCheck.services.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      healthCheck.status = 'unhealthy';
      healthCheck.errors.push('Database health check failed');
    }

    // 2. Active Escrutinio Session Check
    try {
      console.log('🔍 [ESCRUTINIO HEALTH] Verificando sesión activa...');
      const activeSession = await withDatabaseRetry(
        () => prisma.escrutinioSession.findFirst({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            isActive: true,
          },
        }),
        {
          maxRetries: 2,
          onRetry: (error, attempt, maxRetries) => {
            console.error(`❌ [ESCRUTINIO HEALTH] Error obteniendo sesión activa (intento ${attempt}/${maxRetries}):`, error.message);
          }
        }
      );

      if (activeSession) {
        healthCheck.services.activeSession = {
          status: 'healthy',
          session: {
            id: activeSession.id,
            name: activeSession.name,
            startDate: activeSession.startDate.toISOString(),
            endDate: activeSession.endDate?.toISOString() || null,
          },
        };
        console.log('✅ [ESCRUTINIO HEALTH] Sesión activa encontrada:', activeSession.id);
      } else {
        healthCheck.services.activeSession = {
          status: 'unhealthy',
          error: 'No hay sesión activa',
        };
        healthCheck.status = healthCheck.status === 'healthy' ? 'degraded' : healthCheck.status;
        healthCheck.errors.push('No hay sesión de escrutinio activa');
        console.warn('⚠️ [ESCRUTINIO HEALTH] No hay sesión activa');
      }
    } catch (error) {
      console.error('❌ [ESCRUTINIO HEALTH] Error verificando sesión activa:', error);
      healthCheck.services.activeSession = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      healthCheck.status = 'unhealthy';
      healthCheck.errors.push('Failed to check active session');
    }

    // 3. Active Election Check
    try {
      console.log('🔍 [ESCRUTINIO HEALTH] Verificando elección activa...');
      const activeElection = await withDatabaseRetry(
        () => prisma.election.findFirst({
          where: { isActive: true },
          orderBy: { startDate: 'desc' },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            isActive: true,
          },
        }),
        {
          maxRetries: 2,
          onRetry: (error, attempt, maxRetries) => {
            console.error(`❌ [ESCRUTINIO HEALTH] Error obteniendo elección activa (intento ${attempt}/${maxRetries}):`, error.message);
          }
        }
      );

      if (activeElection) {
        healthCheck.services.activeElection = {
          status: 'healthy',
          election: {
            id: activeElection.id,
            name: activeElection.name,
            startDate: activeElection.startDate.toISOString(),
            endDate: activeElection.endDate?.toISOString() || null,
          },
        };
        console.log('✅ [ESCRUTINIO HEALTH] Elección activa encontrada:', activeElection.id);
      } else {
        healthCheck.services.activeElection = {
          status: 'degraded',
          warning: 'No hay elección activa (se creará automáticamente cuando sea necesario)',
        };
        // No marcamos como error porque se crea automáticamente
        console.warn('⚠️ [ESCRUTINIO HEALTH] No hay elección activa (se creará automáticamente)');
      }
    } catch (error) {
      console.error('❌ [ESCRUTINIO HEALTH] Error verificando elección activa:', error);
      healthCheck.services.activeElection = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      healthCheck.status = healthCheck.status === 'healthy' ? 'degraded' : healthCheck.status;
      healthCheck.errors.push('Failed to check active election');
    }

    // 4. Recent Escrutinios Count (optional check)
    try {
      const recentEscrutinios = await withDatabaseRetry(
        () => prisma.escrutinio.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
            },
          },
        }),
        {
          maxRetries: 1,
        }
      );

      healthCheck.services.recentActivity = {
        status: 'healthy',
        escrutiniosLastHour: recentEscrutinios,
      };
    } catch (error) {
      // Not critical, just log
      console.warn('⚠️ [ESCRUTINIO HEALTH] Error obteniendo actividad reciente:', error);
    }

    // Determine final status
    const serviceStatuses = Object.values(healthCheck.services).map((service: any) => service.status);
    if (serviceStatuses.includes('unhealthy')) {
      healthCheck.status = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      healthCheck.status = healthCheck.status === 'healthy' ? 'degraded' : healthCheck.status;
    }

    console.log(`🔍 [ESCRUTINIO HEALTH] Health check completado: ${healthCheck.status}`);

    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;

    return NextResponse.json({
      success: healthCheck.status === 'healthy' || healthCheck.status === 'degraded',
      data: healthCheck,
    }, { status: statusCode });

  } catch (error) {
    console.error('❌ [ESCRUTINIO HEALTH] Error crítico en health check:', error);
    return NextResponse.json(
      { 
        success: false,
        status: 'error',
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

