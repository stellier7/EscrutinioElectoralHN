import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Review sessions API called');
    
    // Autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      console.log('❌ No authorization header found');
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      console.log('❌ Invalid token');
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }
    
    console.log('✅ User authenticated:', { userId: payload.userId, role: payload.role });

    const userId = payload.userId;
    const userRole = payload.role;

    // Get all sessions ordered by startedAt DESC (most recent first)
    const sessions = await prisma.escrutinioSession.findMany({
      orderBy: {
        startedAt: 'desc'
      },
      include: {
        escrutinios: {
          where: {
            status: 'COMPLETED', // Only completed escrutinios
            ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Filter by user role
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

    // Transform sessions data
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

    console.log('📊 Sessions data prepared:', {
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
    console.error('Error fetching review sessions:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
