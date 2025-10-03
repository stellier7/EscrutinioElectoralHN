import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'No token provided',
        debug: {
          authHeader,
          hasAuthHeader: !!authHeader
        }
      }, { status: 401 });
    }
    
    const payload = AuthUtils.verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ 
        success: false, 
        error: 'Token inválido',
        debug: {
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 20) + '...',
          hasToken: !!token
        }
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        status: payload.status
      },
      debug: {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...',
        hasToken: !!token
      }
    });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
