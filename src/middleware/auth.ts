import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    deviceId?: string;
  };
}

export async function authMiddleware(request: NextRequest): Promise<NextResponse | null> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = AuthUtils.extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de acceso requerido' },
        { status: 401 }
      );
    }

    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o expirado' },
        { status: 401 }
      );
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        deviceId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado o inactivo' },
        { status: 401 }
      );
    }

    // Add user info to request
    (request as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      deviceId: user.deviceId || undefined,
    };

    return null; // Continue to the API handler
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // Log additional context for debugging
    console.error('Request URL:', request.url);
    console.error('Request method:', request.method);
    console.error('Request headers:', Object.fromEntries(request.headers.entries()));
    
    return NextResponse.json(
      { success: false, error: 'Error de autenticación' },
      { status: 500 }
    );
  }
}

export function requireAuth(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await authMiddleware(request);
    if (authResult) {
      return authResult; // Return error response
    }
    
    return handler(request as AuthenticatedRequest);
  };
}

export function requireRole(roles: string[]) {
  return function (handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
    return async (request: NextRequest): Promise<NextResponse> => {
      const authResult = await authMiddleware(request);
      if (authResult) {
        return authResult; // Return error response
      }

      const authenticatedRequest = request as AuthenticatedRequest;
      
      if (!authenticatedRequest.user || !roles.includes(authenticatedRequest.user.role)) {
        return NextResponse.json(
          { success: false, error: 'Permisos insuficientes' },
          { status: 403 }
        );
      }
      
      return handler(authenticatedRequest);
    };
  };
}

export function requireDevice(handler: (req: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await authMiddleware(request);
    if (authResult) {
      return authResult; // Return error response
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    const deviceId = request.headers.get('x-device-id');
    
    if (!authenticatedRequest.user?.deviceId || !deviceId || 
        authenticatedRequest.user.deviceId !== deviceId) {
      return NextResponse.json(
        { success: false, error: 'Dispositivo no autorizado' },
        { status: 403 }
      );
    }
    
    return handler(authenticatedRequest);
  };
} 