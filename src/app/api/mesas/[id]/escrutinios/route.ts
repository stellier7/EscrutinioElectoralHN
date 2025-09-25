import { NextRequest, NextResponse } from 'next/server';
import { AuthUtils } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Buscando escrutinios para JRV:', params.id);
    
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

    // Solo admins pueden ver todos los escrutinios
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden acceder' }, { status: 403 });
    }

    const mesaNumber = params.id;

    // Buscar la mesa
    const mesa = await prisma.mesa.findUnique({
      where: { number: mesaNumber }
    });

    if (!mesa) {
      return NextResponse.json({ success: false, error: 'JRV no encontrada' }, { status: 404 });
    }

    // Buscar todos los escrutinios para esta JRV
    const escrutinios = await prisma.escrutinio.findMany({
      where: {
        mesaId: mesa.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        votes: {
          include: {
            candidate: true
          }
        },
        papeletas: true
      },
      orderBy: [
        { status: 'asc' }, // COMPLETED primero, luego FAILED
        { createdAt: 'desc' }
      ]
    });

    // Agrupar por rol del usuario (admin, observer, volunteer)
    const groupedEscrutinios = {
      ADMIN: [] as any[],
      OBSERVER: [] as any[],
      VOLUNTEER: [] as any[],
      ORGANIZATION_MEMBER: [] as any[]
    };

    escrutinios.forEach(escrutinio => {
      const role = escrutinio.user.role as keyof typeof groupedEscrutinios;
      if (groupedEscrutinios[role]) {
        groupedEscrutinios[role].push({
          id: escrutinio.id,
          electionLevel: escrutinio.electionLevel,
          status: escrutinio.status,
          createdAt: escrutinio.createdAt,
          completedAt: escrutinio.completedAt,
          user: escrutinio.user,
          mesaNumber: mesa.number,
          mesaName: mesa.location,
          department: mesa.department,
          actaImageUrl: escrutinio.actaImageUrl,
          voteCount: escrutinio.electionLevel === 'PRESIDENTIAL' 
            ? escrutinio.votes.reduce((sum, vote) => sum + vote.votes, 0)
            : escrutinio.papeletas.reduce((sum, papeleta) => {
                if (papeleta.votesBuffer && Array.isArray(papeleta.votesBuffer)) {
                  return sum + papeleta.votesBuffer.length;
                }
                return sum;
              }, 0)
        });
      }
    });

    console.log('📊 Escrutinios encontrados:', {
      total: escrutinios.length,
      byRole: Object.keys(groupedEscrutinios).reduce((acc, role) => {
        acc[role] = groupedEscrutinios[role as keyof typeof groupedEscrutinios].length;
        return acc;
      }, {} as Record<string, number>)
    });

    return NextResponse.json({
      success: true,
      data: {
        mesa: {
          id: mesa.id,
          number: mesa.number,
          location: mesa.location,
          department: mesa.department
        },
        escrutinios: groupedEscrutinios
      }
    });

  } catch (error) {
    console.error('Error buscando escrutinios por JRV:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    }, { status: 500 });
  }
}
