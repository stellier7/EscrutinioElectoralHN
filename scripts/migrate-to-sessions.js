const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateToSessions() {
  console.log('🔄 Iniciando migración a sistema de sesiones...');
  
  try {
    // Crear sesión por defecto para datos existentes
    const defaultSession = await prisma.escrutinioSession.create({
      data: {
        name: 'Sesión Histórica',
        description: 'Sesión creada automáticamente para migrar datos existentes',
        isActive: false,
        isClosed: true,
        closedAt: new Date(),
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Hace 1 día
      }
    });

    console.log(`✅ Sesión por defecto creada: ${defaultSession.id}`);

    // Obtener todos los escrutinios existentes
    const existingEscrutinios = await prisma.escrutinio.findMany({
      select: { id: true }
    });

    console.log(`📊 Encontrados ${existingEscrutinios.length} escrutinios existentes`);

    if (existingEscrutinios.length > 0) {
      // Actualizar todos los escrutinios existentes para asignarlos a la sesión por defecto
      const updateResult = await prisma.escrutinio.updateMany({
        where: {
          sessionId: null // Esto fallará si sessionId es requerido, pero es para verificar
        },
        data: {
          sessionId: defaultSession.id
        }
      });

      console.log(`✅ ${updateResult.count} escrutinios migrados a la sesión por defecto`);
    }

    // Crear una sesión de prueba activa
    const testSession = await prisma.escrutinioSession.create({
      data: {
        name: 'Test 01',
        description: 'Sesión de prueba para el nuevo sistema',
        isActive: true,
        isClosed: false
      }
    });

    console.log(`✅ Sesión de prueba creada: ${testSession.id}`);

    // Mostrar estadísticas finales
    const sessionCount = await prisma.escrutinioSession.count();
    const escrutinioCount = await prisma.escrutinio.count();
    const activeSession = await prisma.escrutinioSession.findFirst({
      where: { isActive: true }
    });

    console.log('\n📊 Estadísticas finales:');
    console.log(`   Sesiones totales: ${sessionCount}`);
    console.log(`   Escrutinios totales: ${escrutinioCount}`);
    console.log(`   Sesión activa: ${activeSession ? activeSession.name : 'Ninguna'}`);

    console.log('\n✅ Migración completada exitosamente!');
    console.log('💡 Puedes ahora usar el sistema de sesiones desde /admin/sessions');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrateToSessions()
    .then(() => {
      console.log('🎉 Migración finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { migrateToSessions };
