// Rate limiter simple por rol de usuario
// Versión básica para evitar bugs

interface RateLimitConfig {
  requests: number;
  windowMs: number; // en milisegundos
}

// Configuración simple de límites por rol
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  OBSERVER: { requests: 100, windowMs: 60000 },    // 100 req/min - Alta prioridad
  VOLUNTEER: { requests: 50, windowMs: 60000 },     // 50 req/min - Prioridad normal
  ADMIN: { requests: 1000, windowMs: 60000 },       // Sin límite práctico
};

// Cache simple en memoria (para desarrollo)
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

export class SimpleRateLimiter {
  static checkLimit(userId: string, userRole: string): { allowed: boolean; remaining: number; resetTime: number } {
    const config = RATE_LIMITS[userRole] || RATE_LIMITS.VOLUNTEER;
    const now = Date.now();
    const key = `${userId}:${userRole}`;
    
    // Obtener o crear contador del usuario
    let userData = userRequestCounts.get(key);
    
    if (!userData || now > userData.resetTime) {
      // Resetear contador si ha pasado la ventana de tiempo
      userData = {
        count: 0,
        resetTime: now + config.windowMs
      };
      userRequestCounts.set(key, userData);
    }
    
    // Incrementar contador
    userData.count++;
    
    const allowed = userData.count <= config.requests;
    const remaining = Math.max(0, config.requests - userData.count);
    
    return {
      allowed,
      remaining,
      resetTime: userData.resetTime
    };
  }
  
  static getConfig(userRole: string): RateLimitConfig {
    return RATE_LIMITS[userRole] || RATE_LIMITS.VOLUNTEER;
  }
  
  // Limpiar cache (útil para testing)
  static clearCache(): void {
    userRequestCounts.clear();
  }
}
