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
    
    // Obtener datos del cuerpo de la petición (opcional para escrutinios presidenciales)
    let partyCounts, appliedVotes, finalGps;
    try {
      const body = await request.json();
      partyCounts = body.partyCounts;
      appliedVotes = body.appliedVotes;
      finalGps = body.finalGps; // GPS final cuando se cierra el escrutinio
    } catch (error) {
      // Si no hay cuerpo JSON (escrutinio presidencial), usar valores por defecto
      console.log('📝 No se recibieron datos del cuerpo - escrutinio presidencial');
      partyCounts = null;
      appliedVotes = null;
      finalGps = null;
    }
    
    console.log('🔄 Cerrando escrutinio con datos:', { escrutinioId, partyCounts, appliedVotes, finalGps });
    
    // Debug GPS final
    if (finalGps) {
      console.log('📍 [CLOSE API] GPS final recibido:', {
        latitude: finalGps.latitude,
        longitude: finalGps.longitude,
        accuracy: finalGps.accuracy,
        isZero: finalGps.latitude === 0 && finalGps.longitude === 0
      });
    } else {
      console.log('📍 [CLOSE API] No se recibió GPS final');
    }
    const existing = await prisma.escrutinio.findUnique({ 
      where: { id: escrutinioId },
      include: { 
        mesa: {
          select: {
            id: true,
            number: true,
            location: true,
            department: true,
            municipality: true,
            area: true,
            address: true,
            isActive: true,
            // cargaElectoral no se necesita para close, evitar errores si la migración no se ha ejecutado
          }
        }
      }
    });
    if (!existing) return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    
    console.log('📊 Estado actual del escrutinio:', {
      id: existing.id,
      status: existing.status,
      electionLevel: existing.electionLevel,
      mesaNumber: existing.mesa.number
    });

    // Permitir cerrar escrutinios que están COMPLETED, FAILED, o PENDING
    // Para escrutinios PENDING, los marcamos como COMPLETED automáticamente
    if (existing.status !== 'COMPLETED' && existing.status !== 'FAILED' && existing.status !== 'PENDING') {
      return NextResponse.json({ 
        success: false, 
        error: `No se puede cerrar este escrutinio. Estado actual: ${existing.status}` 
      }, { status: 400 });
    }

    // Si está PENDING, marcarlo como COMPLETED automáticamente
    if (existing.status === 'PENDING') {
      console.log('🔄 [CLOSE API] Marcando escrutinio PENDING como COMPLETED automáticamente');
      await prisma.escrutinio.update({
        where: { id: escrutinioId },
        data: { 
          status: 'COMPLETED',
          isCompleted: true,
          completedAt: new Date()
        }
      });
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
        const votesBuffer: Array<{
          partyId: string;
          casillaNumber: number;
          timestamp: string;
        }> = [];
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

    // Guardar versión original si es la primera vez que se cierra
    let originalData = null;
    if (!existing.hasEdits && partyCounts && appliedVotes) {
      // Obtener todas las papeletas cerradas para guardar como versión original
      const closedPapeletas = await prisma.papeleta.findMany({
        where: {
          escrutinioId: escrutinioId,
          status: 'CLOSED'
        }
      });
      
      originalData = {
        partyCounts,
        appliedVotes,
        papeletas: closedPapeletas.map(p => ({
          id: p.id,
          votesBuffer: p.votesBuffer,
          closedAt: p.closedAt
        })),
        timestamp: new Date().toISOString()
      };
      
      console.log('💾 Guardando versión original:', originalData);
    }

    // Actualizar status a CLOSED con GPS final
    const updateData: any = { 
      status: 'CLOSED',
      ...(originalData && { originalData: originalData })
    };
    
    // Agregar GPS final si está disponible
    if (finalGps && finalGps.latitude && finalGps.longitude) {
      updateData.finalLatitude = finalGps.latitude;
      updateData.finalLongitude = finalGps.longitude;
      updateData.finalLocationAccuracy = finalGps.accuracy || 0;
      
      console.log('📍 [CLOSE API] Guardando GPS final:', {
        finalLatitude: finalGps.latitude,
        finalLongitude: finalGps.longitude,
        finalLocationAccuracy: finalGps.accuracy || 0
      });
    }
    
    await prisma.escrutinio.update({
      where: { id: escrutinioId },
      data: updateData,
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
