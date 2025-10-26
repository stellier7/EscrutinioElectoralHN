import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const escrutinioId = params.id;
    const userId = payload.userId;

    // Verificar que el escrutinio existe y pertenece al usuario
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      select: { id: true, userId: true }
    });

    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }

    if (escrutinio.userId !== userId) {
      return NextResponse.json({ success: false, error: 'No autorizado para este escrutinio' }, { status: 403 });
    }

    // Obtener datos del cuerpo de la petición
    const body = await request.json();
    const { action, votesSnapshot, deviceId, gps } = body;

    // Validar acción
    if (!action || !['FREEZE', 'UNFREEZE'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 });
    }

    // Validar votesSnapshot
    if (!votesSnapshot || typeof votesSnapshot !== 'object') {
      return NextResponse.json({ success: false, error: 'Snapshot de votos inválido' }, { status: 400 });
    }

    // Log detallado del snapshot de votos
    const totalVotes = Object.values(votesSnapshot).reduce((sum: number, count: any) => sum + count, 0);
    console.log(`📊 [CHECKPOINT] Snapshot de votos recibido:`, {
      escrutinioId,
      action,
      totalVotes,
      candidatesCount: Object.keys(votesSnapshot).length,
      votesSnapshot: votesSnapshot
    });

    // Calcular hash SHA-256 del snapshot para verificación de integridad
    const snapshotString = JSON.stringify(votesSnapshot);
    const snapshotHash = crypto.createHash('sha256').update(snapshotString).digest('hex');
    console.log(`🔐 [CHECKPOINT] Hash calculado: ${snapshotHash.substring(0, 8)}...`);

    // Crear checkpoint
    const checkpoint = await prisma.escrutinioCheckpoint.create({
      data: {
        escrutinioId,
        userId,
        action,
        votesSnapshot,
        snapshotHash, // Hash para verificación de integridad
        timestamp: new Date(),
        deviceId,
        gpsLatitude: gps?.latitude,
        gpsLongitude: gps?.longitude,
        gpsAccuracy: gps?.accuracy,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`✅ [CHECKPOINT] ${action} guardado para escrutinio ${escrutinioId} por usuario ${userId}`, {
      checkpointId: checkpoint.id,
      totalVotes,
      gps: gps ? `${gps.latitude}, ${gps.longitude}` : 'No GPS'
    });

    return NextResponse.json({
      success: true,
      data: {
        checkpoint: {
          id: checkpoint.id,
          action: checkpoint.action,
          timestamp: checkpoint.timestamp,
          user: checkpoint.user
        }
      }
    });

  } catch (error) {
    console.error('Error creando checkpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const payload = AuthUtils.verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const escrutinioId = params.id;
    const userId = payload.userId;

    // Verificar que el escrutinio existe y pertenece al usuario
    const escrutinio = await prisma.escrutinio.findUnique({
      where: { id: escrutinioId },
      select: { id: true, userId: true }
    });

    if (!escrutinio) {
      return NextResponse.json({ success: false, error: 'Escrutinio no encontrado' }, { status: 404 });
    }

    if (escrutinio.userId !== userId) {
      return NextResponse.json({ success: false, error: 'No autorizado para este escrutinio' }, { status: 403 });
    }

    // Obtener checkpoints del escrutinio
    const checkpoints = await prisma.escrutinioCheckpoint.findMany({
      where: { escrutinioId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: { checkpoints }
    });

  } catch (error) {
    console.error('Error obteniendo checkpoints:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
