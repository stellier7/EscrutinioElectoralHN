import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Dashboard stats API called');
    
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

    // Obtener estadísticas generales (todos los usuarios ven números globales)
    const totalMesas = await prisma.mesa.count({
      where: { isActive: true },
    });

    // Get active session first
    const activeSession = await prisma.escrutinioSession.findFirst({
      where: { isActive: true }
    });

    // If no active session, return empty stats
    if (!activeSession) {
      console.log('📊 No active session found, returning empty stats');
      return NextResponse.json({
        success: true,
        data: {
          totalMesas,
          completedEscrutinios: 0,
          pendingEscrutinios: 0,
          inProgressActivity: [],
          recentActivity: [],
          statsByLevel: [
            { level: 'PRESIDENTIAL', completed: 0, pending: 0, total: 0 },
            { level: 'LEGISLATIVE', completed: 0, pending: 0, total: 0 },
            { level: 'MUNICIPAL', completed: 0, pending: 0, total: 0 }
          ]
        }
      });
    }

    console.log('📊 Active session found:', activeSession.name);

    const completedEscrutinios = await prisma.escrutinio.count({
      where: { 
        status: 'COMPLETED',
        sessionId: activeSession.id  // Filter by active session
      },
    });

    const pendingEscrutinios = await prisma.escrutinio.count({
      where: { 
        status: { in: ['PENDING', 'IN_PROGRESS'] }, // Solo escrutinios abiertos (no completados)
        sessionId: activeSession.id  // Filter by active session
      },
    });

    // Obtener escrutinios en progreso (abiertos, no completados)
    const inProgressEscrutinios = await prisma.escrutinio.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] }, // Escrutinios abiertos (en progreso)
        sessionId: activeSession.id,  // Filter by active session
        // Excluir escrutinios cancelados (FAILED)
        ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Solo admins ven todos
      },
      include: {
        mesa: true,
        election: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Obtener escrutinios finalizados (para revisar)
    const completedEscrutiniosList = await prisma.escrutinio.findMany({
      where: {
        status: 'COMPLETED',
        sessionId: activeSession.id,  // Filter by active session
        completedAt: { not: null }, // Solo los que tienen fecha de completado
        ...(userRole === 'ADMIN' ? {} : { userId: userId }), // Solo admins ven todos
      },
      include: {
        mesa: true,
        election: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: 5,
    });

    const inProgressActivity = inProgressEscrutinios.map(escrutinio => ({
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.location,
      department: escrutinio.mesa.department,
      electionLevel: escrutinio.electionLevel,
      status: escrutinio.status, // Usar el status real del escrutinio
      createdAt: escrutinio.createdAt,
    }));

    const recentActivity = completedEscrutiniosList.map(escrutinio => ({
      id: escrutinio.id,
      mesaNumber: escrutinio.mesa.number,
      mesaName: escrutinio.mesa.location,
      department: escrutinio.mesa.department,
      electionLevel: escrutinio.electionLevel,
      status: 'COMPLETED',
      completedAt: escrutinio.completedAt,
    }));

    // Obtener estadísticas por nivel electoral (todos ven números globales)
    const statsByLevel = await Promise.all(
      ['PRESIDENTIAL', 'LEGISLATIVE', 'MUNICIPAL'].map(async (level) => {
        const completed = await prisma.escrutinio.count({
          where: {
            status: 'COMPLETED',
            electionLevel: level as any,
            sessionId: activeSession.id,  // Filter by active session
          },
        });

        const pending = await prisma.escrutinio.count({
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] }, // Solo escrutinios abiertos
            electionLevel: level as any,
            sessionId: activeSession.id,  // Filter by active session
          },
        });

        return {
          level,
          completed,
          pending,
          total: completed + pending,
        };
      })
    );

    const responseData = {
      totalMesas,
      completedEscrutinios,
      pendingEscrutinios,
      inProgressActivity,
      recentActivity,
      statsByLevel,
    };
    
    console.log('📊 Dashboard stats data:', responseData);
    
    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
