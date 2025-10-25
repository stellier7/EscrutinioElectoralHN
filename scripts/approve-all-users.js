const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function approveAllUsers() {
  try {
    console.log('🔧 Aprobando todos los usuarios...');

    // Primero obtener el ID del admin para usarlo como approvedBy
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@escrutinio.com' },
      select: { id: true }
    });

    if (!adminUser) {
      throw new Error('No se encontró el usuario admin');
    }

    // Aprobar todos los usuarios que estén en PENDING
    const result = await prisma.user.updateMany({
      where: {
        status: 'PENDING'
      },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: adminUser.id
      }
    });

    console.log(`✅ ${result.count} usuarios aprobados automáticamente`);

    // Mostrar todos los usuarios y sus estados
    const allUsers = await prisma.user.findMany({
      select: {
        email: true,
        name: true,
        role: true,
        status: true,
        isActive: true
      }
    });

    console.log('\n📋 Estado actual de todos los usuarios:');
    allUsers.forEach(user => {
      console.log(`👤 ${user.email} (${user.name}) - Rol: ${user.role} - Estado: ${user.status} - Activo: ${user.isActive}`);
    });

    console.log('\n🎉 ¡Todos los usuarios están aprobados y listos para usar!');
    console.log('\n📋 Credenciales disponibles:');
    console.log('👤 Admin: admin@escrutinio.com / admin123');
    console.log('🔍 Auditor: auditor@escrutinio.com / auditor123');

  } catch (error) {
    console.error('❌ Error aprobando usuarios:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  approveAllUsers();
}

module.exports = { approveAllUsers };
