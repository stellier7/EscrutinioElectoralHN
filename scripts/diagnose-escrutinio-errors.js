/**
 * Script de diagnóstico para errores de escrutinio
 * Verifica el estado de la base de datos y detecta problemas comunes
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function diagnose() {
  console.log('🔍 Iniciando diagnóstico de escrutinios...\n');

  try {
    // 1. Verificar conexión a base de datos
    console.log('1️⃣ Verificando conexión a base de datos...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('   ✅ Conexión a base de datos OK\n');

    // 2. Verificar sesión activa
    console.log('2️⃣ Verificando sesión activa...');
    const activeSession = await prisma.escrutinioSession.findFirst({
      where: { isActive: true }
    });
    if (activeSession) {
      console.log(`   ✅ Sesión activa encontrada: ${activeSession.id}`);
      console.log(`      Nombre: ${activeSession.name}`);
    } else {
      console.log('   ⚠️  No hay sesión activa - esto causará errores al iniciar escrutinios');
    }
    console.log();

    // 3. Verificar elección activa
    console.log('3️⃣ Verificando elección activa...');
    const activeElection = await prisma.election.findFirst({
      where: { isActive: true }
    });
    if (activeElection) {
      console.log(`   ✅ Elección activa encontrada: ${activeElection.id}`);
      console.log(`      Nombre: ${activeElection.name}`);
    } else {
      console.log('   ⚠️  No hay elección activa (se creará automáticamente)');
    }
    console.log();

    // 4. Verificar escrutinios con estados inconsistentes
    console.log('4️⃣ Verificando escrutinios con estados inconsistentes...');
    const inconsistent = await prisma.escrutinio.findMany({
      where: {
        OR: [
          {
            status: 'COMPLETED',
            completedAt: null
          },
          {
            status: 'CLOSED',
            completedAt: null
          }
        ]
      },
      select: {
        id: true,
        status: true,
        completedAt: true,
        isCompleted: true,
        createdAt: true
      }
    });
    if (inconsistent.length > 0) {
      console.log(`   ⚠️  Encontrados ${inconsistent.length} escrutinios con estados inconsistentes:`);
      inconsistent.forEach(e => {
        console.log(`      - ID: ${e.id}, Status: ${e.status}, completedAt: ${e.completedAt}, isCompleted: ${e.isCompleted}`);
      });
    } else {
      console.log('   ✅ No hay escrutinios con estados inconsistentes');
    }
    console.log();

    // 5. Contar escrutinios por estado
    console.log('5️⃣ Contando escrutinios por estado...');
    const statusCounts = await prisma.escrutinio.groupBy({
      by: ['status'],
      _count: true
    });
    statusCounts.forEach(({ status, _count }) => {
      console.log(`      ${status}: ${_count}`);
    });
    console.log();

    // 6. Verificar mesas activas
    console.log('6️⃣ Verificando mesas activas...');
    const activeMesas = await prisma.mesa.count({
      where: { isActive: true }
    });
    console.log(`   ✅ Mesas activas: ${activeMesas}`);
    console.log();

    // 7. Probar query de check-active para una mesa específica
    console.log('7️⃣ Probando query de check-active para JRV 00678...');
    try {
      const testEscrutinios = await prisma.escrutinio.findMany({
        where: {
          mesa: {
            number: '00678'
          },
          status: {
            in: ['PENDING', 'IN_PROGRESS']
          },
          completedAt: null,
          isCompleted: false,
        },
        include: {
          mesa: {
            select: {
              id: true,
              number: true,
              location: true,
              department: true,
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      console.log(`   ✅ Query exitosa. Escrutinios activos encontrados: ${testEscrutinios.length}`);
    } catch (error) {
      console.log(`   ❌ Error en query: ${error.message}`);
    }
    console.log();

    // 8. Verificar si hay problemas con cargaElectoral
    console.log('8️⃣ Verificando columna cargaElectoral...');
    try {
      const mesaTest = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Mesa' AND column_name = 'cargaElectoral'
      `;
      if (mesaTest && mesaTest.length > 0) {
        console.log('   ✅ Columna cargaElectoral existe');
      } else {
        console.log('   ⚠️  Columna cargaElectoral no existe (esto es normal si no se ha migrado)');
      }
    } catch (error) {
      console.log(`   ⚠️  No se pudo verificar cargaElectoral: ${error.message}`);
    }
    console.log();

    console.log('✅ Diagnóstico completado');

  } catch (error) {
    console.error('❌ Error durante diagnóstico:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

diagnose()
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });

