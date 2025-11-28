import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 API de sesiones de revisión llamada');
    
    // Autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      console.log('❌ No se encontró header de autorización');
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      console.log('❌ Token inválido');
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }
    
    console.log('✅ Usuario autenticado:', { userId: payload.userId, role: payload.role });

    const userId = payload.userId;
    const userRole = payload.role;

    // Obtener todas las sesiones ordenadas por startedAt DESC (más recientes primero)
    const sessions = await prisma.escrutinioSession.findMany({
      orderBy: {
        startedAt: 'desc'
      },
      include: {
        escrutinios: {
          where: {
            status: 'COMPLETED', // Solo escrutinios completados
            ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Filtrar por rol de usuario
          },
          include: {
            mesa: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            completedAt: 'desc'
          }
        }
      }
    });

    // Transformar datos de sesiones
    const sessionsData = sessions.map(session => ({
      id: session.id,
      name: session.name,
      description: session.description,
      isActive: session.isActive,
      isClosed: session.isClosed,
      startedAt: session.startedAt,
      closedAt: session.closedAt,
      escrutinios: session.escrutinios.map(escrutinio => ({
        id: escrutinio.id,
        mesaNumber: escrutinio.mesa.number,
        mesaName: escrutinio.mesa.location,
        department: escrutinio.mesa.department,
        electionLevel: escrutinio.electionLevel,
        completedAt: escrutinio.completedAt,
        user: escrutinio.user
      })),
      stats: {
        total: session.escrutinios.length,
        completed: session.escrutinios.length
      }
    }));

    console.log('📊 Datos de sesiones preparados:', {
      totalSessions: sessionsData.length,
      activeSessions: sessionsData.filter(s => s.isActive).length,
      closedSessions: sessionsData.filter(s => s.isClosed).length
    });
    
    return NextResponse.json({
      success: true,
      data: {
        sessions: sessionsData
      }
    });
  } catch (error) {
    console.error('Error obteniendo sesiones de revisión:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
