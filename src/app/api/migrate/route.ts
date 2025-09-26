import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Verificando y arreglando base de datos...');
    
    // Verificar si las tablas existen
    try {
      // Intentar hacer una consulta simple para verificar la conexión
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Conexión a base de datos exitosa');
    } catch (error) {
      console.error('❌ Error de conexión a base de datos:', error);
      return NextResponse.json({
        success: false,
        error: 'Error de conexión a base de datos',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Verificar si la tabla escrutinio existe y tiene la estructura correcta
    try {
      const escrutinioCount = await prisma.escrutinio.count();
      console.log('✅ Tabla escrutinio existe, count:', escrutinioCount);
    } catch (error) {
      console.error('❌ Error con tabla escrutinio:', error);
      return NextResponse.json({
        success: false,
        error: 'Tabla escrutinio no existe o tiene problemas',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Verificar si la tabla mesa existe
    try {
      const mesaCount = await prisma.mesa.count();
      console.log('✅ Tabla mesa existe, count:', mesaCount);
    } catch (error) {
      console.error('❌ Error con tabla mesa:', error);
      return NextResponse.json({
        success: false,
        error: 'Tabla mesa no existe o tiene problemas',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Verificar si la tabla department existe
    try {
      const departmentCount = await prisma.department.count();
      console.log('✅ Tabla department existe, count:', departmentCount);
    } catch (error) {
      console.error('❌ Error con tabla department:', error);
      return NextResponse.json({
        success: false,
        error: 'Tabla department no existe o tiene problemas',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Verificar si la columna originalData existe en la tabla escrutinio
    try {
      const testQuery = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'escrutinios' 
        AND column_name = 'originalData'
      `;
      console.log('🔍 Verificando columna originalData:', testQuery);
      
      if (!testQuery || (testQuery as any[]).length === 0) {
        console.log('⚠️ Columna originalData no existe, agregándola...');
        
        // Agregar la columna originalData
        await prisma.$executeRaw`
          ALTER TABLE escrutinios 
          ADD COLUMN "originalData" JSONB
        `;
        console.log('✅ Columna originalData agregada exitosamente');
      } else {
        console.log('✅ Columna originalData ya existe');
      }
    } catch (error) {
      console.error('❌ Error verificando/agregando columna originalData:', error);
      return NextResponse.json({
        success: false,
        error: 'Error con columna originalData',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Base de datos verificada y arreglada exitosamente',
      tables: {
        escrutinio: 'OK',
        mesa: 'OK', 
        department: 'OK'
      },
      fixes: {
        originalData: 'Column added/verified'
      }
    });
    
  } catch (error) {
    console.error('❌ Error verificando base de datos:', error);
    return NextResponse.json({
      success: false,
      error: 'Error verificando base de datos',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}