import { prisma } from './prisma';

export interface DatabaseHealth {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();
  
  try {
    // Hacer una consulta simple para verificar la conexión
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      isHealthy: true,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('Database health check failed:', error);
    
    return {
      isHealthy: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function waitForDatabase(maxWaitTime = 30000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const health = await checkDatabaseHealth();
    
    if (health.isHealthy) {
      return true;
    }
    
    // Esperar 1 segundo antes del siguiente intento
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}
