import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Checking active escrutinio for JRV:', params.id);
    
    // Autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const mesaNumber = params.id;

    // Buscar escrutinios activos para esta JRV
    const activeEscrutinios = await prisma.escrutinio.findMany({
      where: {
        mesa: {
          number: mesaNumber
        },
        status: 'COMPLETED', // En progreso (no cerrado ni finalizado)
        completedAt: null, // No finalizado
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
        createdAt: 'desc'
      }
    });

    console.log('📊 Escrutinios activos encontrados:', activeEscrutinios.length);

    if (activeEscrutinios.length > 0) {
      const latestEscrutinio = activeEscrutinios[0];
      return NextResponse.json({
        success: true,
        hasActive: true,
        escrutinio: {
          id: latestEscrutinio.id,
          electionLevel: latestEscrutinio.electionLevel,
          createdAt: latestEscrutinio.createdAt,
          user: latestEscrutinio.user,
          mesaNumber: latestEscrutinio.mesa.number,
          mesaName: latestEscrutinio.mesa.location
        }
      });
    }

    return NextResponse.json({
      success: true,
      hasActive: false
    });

  } catch (error) {
    console.error('Error checking active escrutinio:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
