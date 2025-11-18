import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthUtils } from '@/lib/auth';
import { AuditLogger } from '@/lib/audit';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

// POST /api/admin/jrvs/update - Actualizar JRVs desde archivo Excel
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

    // Verificar que no hay sesión activa
    const activeSession = await prisma.escrutinioSession.findFirst({
      where: { isActive: true }
    });

    if (activeSession) {
      return NextResponse.json(
        { 
          success: false, 
          error: `No se pueden actualizar JRVs mientras hay una sesión activa: "${activeSession.name}". Debe cerrar la sesión primero.` 
        },
        { status: 400 }
      );
    }

    // Obtener el archivo del request
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    // Verificar tipo de archivo
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, error: 'El archivo debe ser un Excel (.xlsx o .xls)' },
        { status: 400 }
      );
    }

    // Leer y procesar el archivo Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El archivo Excel está vacío o no tiene datos válidos' },
        { status: 400 }
      );
    }

    // Procesar datos según el formato esperado
    const processedJRVs = data.map((row: any, index: number) => {
      return {
        number: String(row['JRV'] || (index + 1)).padStart(5, '0'),
        location: row['CENTRO DE VOTACION']?.toString().trim() || 'Ubicación no especificada',
        address: `${row['CODIGO SECTOR ELECTORAL'] || ''}-${row['NOMBRE SECTOR ELECTORAL'] || ''}`.trim(),
        department: `${row['CD'] || ''}-${row['NOMBRE DEPARTAMENTO'] || ''}`.trim(),
        municipality: `${row['CM'] || ''}-${row['NOMBRE MUNICIPIO'] || ''}`.trim(),
        area: `${row['CODIGO AREA'] || ''}-${row['DESCRIPCION AREA'] || ''}`.trim(),
        cargaElectoral: row['CARGA ELECTORAL JRV'] || null,
        latitude: null,
        longitude: null,
        isActive: true
      };
    }).filter(jrv => jrv.department && jrv.department !== 'Departamento no especificado');

    if (processedJRVs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron JRVs válidas en el archivo' },
        { status: 400 }
      );
    }

    // Usar transacción para actualizar JRVs
    const result = await prisma.$transaction(async (tx) => {
      // Obtener estadísticas antes del cambio
      const oldStats = await tx.mesa.count();
      const oldActiveStats = await tx.mesa.count({ where: { isActive: true } });

      // Desactivar todas las JRVs existentes (no eliminar para preservar historial)
      await tx.mesa.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // Insertar nuevas JRVs
      const newMesas = await tx.mesa.createMany({
        data: processedJRVs,
        skipDuplicates: true
      });

      // Obtener estadísticas después del cambio
      const newStats = await tx.mesa.count();
      const newActiveStats = await tx.mesa.count({ where: { isActive: true } });

      return {
        oldStats,
        oldActiveStats,
        newStats,
        newActiveStats,
        processedCount: processedJRVs.length,
        insertedCount: newMesas.count
      };
    });

    // Registrar en audit log
    await AuditLogger.log(
      'UPDATE_JRVS',
      `JRVs actualizadas desde archivo: ${file.name}`,
      payload.userId,
      {
        fileName: file.name,
        fileSize: file.size,
        processedCount: result.processedCount,
        insertedCount: result.insertedCount,
        oldActiveCount: result.oldActiveStats,
        newActiveCount: result.newActiveStats
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        processedCount: result.processedCount,
        insertedCount: result.insertedCount,
        oldActiveCount: result.oldActiveStats,
        newActiveCount: result.newActiveStats
      },
      message: `JRVs actualizadas exitosamente. ${result.insertedCount} nuevas JRVs activas.`
    });

  } catch (error: any) {
    console.error('Error updating JRVs:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
