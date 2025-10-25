import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { AuditLogger } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/admin/sessions - Listar todas las sesiones
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    
    const payload = AuthUtils.verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Obtener todas las sesiones con estadísticas
    const sessions = await prisma.escrutinioSession.findMany({
      include: {
        _count: {
          select: {
            escrutinios: true
          }
        },
        closedByUser: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calcular estadísticas adicionales para cada sesión
    const sessionsWithStats = await Promise.all(
      sessions.map(async (session) => {
        const escrutinios = await prisma.escrutinio.findMany({
          where: { sessionId: session.id },
          include: {
            votes: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        });

        const totalVotes = escrutinios.reduce((sum, escrutinio) => {
          return sum + escrutinio.votes.reduce((voteSum, vote) => voteSum + vote.count, 0);
        }, 0);

        const uniqueUsers = new Set(escrutinios.map(e => e.userId)).size;

        return {
          ...session,
          stats: {
            totalEscrutinios: escrutinios.length,
            totalVotes,
            uniqueUsers,
            completedEscrutinios: escrutinios.filter(e => e.isCompleted).length
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: sessionsWithStats
    });

  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/admin/sessions - Crear nueva sesión
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    
    const payload = AuthUtils.verifyToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, activateImmediately = false } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'El nombre de la sesión es requerido' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una sesión activa
    const activeSession = await prisma.escrutinioSession.findFirst({
      where: { isActive: true }
    });

    if (activeSession && activateImmediately) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una sesión activa. Debe cerrarla antes de activar una nueva.' },
        { status: 400 }
      );
    }

    // Crear la nueva sesión
    const session = await prisma.escrutinioSession.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: activateImmediately,
        isClosed: false
      }
    });

    // Si se debe activar inmediatamente, desactivar cualquier otra sesión activa
    if (activateImmediately) {
      await prisma.escrutinioSession.updateMany({
        where: { 
          isActive: true,
          id: { not: session.id }
        },
        data: { isActive: false }
      });
    }

    // Registrar en audit log
    await AuditLogger.log(
      'CREATE_SESSION',
      `Sesión creada: ${session.name}`,
      payload.userId,
      {
        sessionId: session.id,
        sessionName: session.name,
        activated: activateImmediately
      }
    );

    return NextResponse.json({
      success: true,
      data: session
    });

  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
