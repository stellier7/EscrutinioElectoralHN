import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Aplicando migraciones de base de datos...');
    
    // Aplicar migraciones
    const { stdout: migrateOutput, stderr: migrateError } = await execAsync('npx prisma migrate deploy');
    console.log('📊 Migrate output:', migrateOutput);
    if (migrateError) {
      console.error('❌ Migrate error:', migrateError);
    }
    
    // Generar cliente de Prisma
    const { stdout: generateOutput, stderr: generateError } = await execAsync('npx prisma generate');
    console.log('📊 Generate output:', generateOutput);
    if (generateError) {
      console.error('❌ Generate error:', generateError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Migraciones aplicadas exitosamente',
      migrateOutput,
      generateOutput
    });
    
  } catch (error) {
    console.error('❌ Error aplicando migraciones:', error);
    return NextResponse.json({
      success: false,
      error: 'Error aplicando migraciones',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}