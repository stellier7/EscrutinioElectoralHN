const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyDatabaseStatus() {
  try {
    console.log('🔍 Verificando estado de la base de datos...\n');

    // Contar registros en cada tabla
    const userCount = await prisma.user.count();
    const mesaCount = await prisma.mesa.count();
    const sessionCount = await prisma.escrutinioSession.count();
    const escrutinioCount = await prisma.escrutinio.count();
    const departmentCount = await prisma.department.count();
    const electionCount = await prisma.election.count();
    const candidateCount = await prisma.candidate.count();

    console.log('📊 ESTADO ACTUAL DE LA BASE DE DATOS:');
    console.log('=====================================');
    console.log(`👥 Usuarios: ${userCount}`);
    console.log(`🗳️  Mesas/JRVs: ${mesaCount}`);
    console.log(`📅 Sesiones: ${sessionCount}`);
    console.log(`📝 Escrutinios: ${escrutinioCount}`);
    console.log(`🏛️  Departamentos: ${departmentCount}`);
    console.log(`🗳️  Elecciones: ${electionCount}`);
    console.log(`👤 Candidatos: ${candidateCount}`);
    console.log('=====================================\n');

    // Mostrar usuarios existentes
    if (userCount > 0) {
      console.log('👥 USUARIOS EXISTENTES:');
      const users = await prisma.user.findMany({
        select: {
          email: true,
          name: true,
          role: true,
          status: true,
          isActive: true,
          createdAt: true
        }
      });
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.name})`);
        console.log(`     Rol: ${user.role} | Estado: ${user.status} | Activo: ${user.isActive}`);
        console.log(`     Creado: ${user.createdAt.toISOString()}`);
      });
      console.log('');
    }

    // Mostrar sesiones existentes
    if (sessionCount > 0) {
      console.log('📅 SESIONES EXISTENTES:');
      const sessions = await prisma.escrutinioSession.findMany({
        select: {
          id: true,
          name: true,
          isActive: true,
          isClosed: true,
          startedAt: true,
          _count: {
            select: { escrutinios: true }
          }
        }
      });
      sessions.forEach(session => {
        console.log(`   - ${session.name} (ID: ${session.id})`);
        console.log(`     Activa: ${session.isActive} | Cerrada: ${session.isClosed}`);
        console.log(`     Escrutinios: ${session._count.escrutinios}`);
      });
      console.log('');
    }

    // Verificar si hay datos en archivos JSON
    const fs = require('fs');
    const path = require('path');
    
    const jrvsPath = path.join(__dirname, '..', 'data', 'jrvs.json');
    const deptPath = path.join(__dirname, '..', 'data', 'diputados-por-departamento.json');
    
    if (fs.existsSync(jrvsPath)) {
      const jrvsData = JSON.parse(fs.readFileSync(jrvsPath, 'utf8'));
      console.log(`📁 Archivo jrvs.json: ${jrvsData.length} JRVs disponibles para restaurar`);
    }
    
    if (fs.existsSync(deptPath)) {
      const deptData = JSON.parse(fs.readFileSync(deptPath, 'utf8'));
      console.log(`📁 Archivo diputados-por-departamento.json: ${deptData.length} departamentos disponibles`);
    }

    console.log('\n⚠️  RESUMEN:');
    if (mesaCount === 0) {
      console.log('❌ NO HAY MESAS/JRVs - Necesitan ser restauradas');
    }
    if (sessionCount === 0) {
      console.log('❌ NO HAY SESIONES - Necesitan ser creadas');
    }
    if (escrutinioCount === 0) {
      console.log('⚠️  NO HAY ESCRUTINIOS (esto puede ser normal si no había datos de prueba)');
    }
    if (userCount === 2) {
      console.log('⚠️  SOLO 2 USUARIOS (admin y auditor) - Otros usuarios se perdieron');
    }

  } catch (error) {
    console.error('❌ Error verificando base de datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabaseStatus();
