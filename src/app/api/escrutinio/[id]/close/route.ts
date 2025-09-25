import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    const escrutinioId = params.id;
    
    // Obtener datos del cuerpo de la petición
    const body = await request.json();
    const { partyCounts, appliedVotes } = body;
    
    console.log('🔄 Cerrando escrutinio con datos:', { escrutinioId, partyCounts, appliedVotes });
    const existing = await prisma.escrutinio.findUnique({ 
      where: { id: escrutinioId },
      include: { mesa: true }
    });
    if (!existing) return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });

    // Solo permitir cerrar escrutinios que están COMPLETED (en progreso)
    if (existing.status !== 'COMPLETED') {
      return NextResponse.json({ 
        success: false, 
        error: `No se puede cerrar este escrutinio. Estado actual: ${existing.status}` 
      }, { status: 400 });
    }

    // Cerrar automáticamente cualquier papeleta abierta antes de cerrar el escrutinio
    console.log('🔄 Cerrando papeletas abiertas antes de cerrar escrutinio...');
    const openPapeletas = await prisma.papeleta.findMany({
      where: {
        escrutinioId: escrutinioId,
        status: 'OPEN'
      }
    });

    if (openPapeletas.length > 0) {
      console.log(`📄 Cerrando ${openPapeletas.length} papeletas abiertas`);
      
      // Si hay votos en appliedVotes, guardarlos en la papeleta abierta
      if (appliedVotes && Object.keys(appliedVotes).length > 0) {
        console.log('💾 Guardando votos en papeleta abierta:', appliedVotes);
        
        // Convertir appliedVotes a votesBuffer para la papeleta
        const votesBuffer = [];
        Object.entries(appliedVotes).forEach(([partyId, casillas]: [string, any]) => {
          Object.entries(casillas).forEach(([casillaNumber, votes]: [string, any]) => {
            for (let i = 0; i < votes; i++) {
              votesBuffer.push({
                partyId,
                casillaNumber: parseInt(casillaNumber),
                timestamp: new Date().toISOString()
              });
            }
          });
        });
        
        console.log('📊 VotesBuffer generado:', votesBuffer);
        
        // Actualizar la papeleta abierta con los votos
        await prisma.papeleta.updateMany({
          where: {
            escrutinioId: escrutinioId,
            status: 'OPEN'
          },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            votesBuffer: votesBuffer
          }
        });
      } else {
        // Solo cerrar sin votos
        await prisma.papeleta.updateMany({
          where: {
            escrutinioId: escrutinioId,
            status: 'OPEN'
          },
          data: {
            status: 'CLOSED',
            closedAt: new Date()
          }
        });
      }
    }

    // Actualizar status a CLOSED
    await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: { status: 'CLOSED' },
    });

    // Crear log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: 'CLOSE_ESCRUTINIO',
        description: `Escrutinio cerrado para JRV ${existing.mesa.number}`,
        metadata: {
          escrutinioId,
          mesaNumber: existing.mesa.number,
          electionLevel: existing.electionLevel,
          timestamp: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error cerrando escrutinio:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
