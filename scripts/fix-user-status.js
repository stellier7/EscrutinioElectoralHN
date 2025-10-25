const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixUserStatus() {
  try {
    console.log('🔧 Verificando y corrigiendo estados de usuarios...');

    // Buscar usuarios que puedan tener problemas
    const problematicUsers = await prisma.user.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'REJECTED' },
          { status: 'SUSPENDED' },
          { isActive: false }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isActive: true
      }
    });

    if (problematicUsers.length === 0) {
      console.log('✅ Todos los usuarios están en buen estado');
      return;
    }

    console.log(`⚠️  Encontrados ${problematicUsers.length} usuarios con problemas:`);
    problematicUsers.forEach(user => {
      console.log(`   - ${user.email}: status=${user.status}, active=${user.isActive}`);
    });

    // Obtener admin para usar como approvedBy
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@escrutinio.com' },
      select: { id: true }
    });

    if (!adminUser) {
      console.log('❌ No se encontró usuario admin para aprobar otros usuarios');
      return;
    }

    // Corregir todos los usuarios problemáticos
    const result = await prisma.user.updateMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'REJECTED' },
          { status: 'SUSPENDED' },
          { isActive: false }
        ]
      },
      data: {
        status: 'APPROVED',
        isActive: true,
        approvedAt: new Date(),
        approvedBy: adminUser.id
      }
    });

    console.log(`✅ ${result.count} usuarios corregidos y aprobados`);

    // Mostrar estado final
    const allUsers = await prisma.user.findMany({
      select: {
        email: true,
        name: true,
        role: true,
        status: true,
        isActive: true
      }
    });

    console.log('\n📋 Estado final de todos los usuarios:');
    allUsers.forEach(user => {
      const status = user.status === 'APPROVED' && user.isActive ? '✅' : '❌';
      console.log(`${status} ${user.email} (${user.name}) - Rol: ${user.role} - Estado: ${user.status} - Activo: ${user.isActive}`);
    });

  } catch (error) {
    console.error('❌ Error corrigiendo usuarios:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixUserStatus();
}

module.exports = { fixUserStatus };
