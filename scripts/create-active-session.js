const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createActiveSession() {
  try {
    console.log('📅 Creando sesión activa...\n');

    // Verificar si ya hay una sesión activa
    const existingActive = await prisma.escrutinioSession.findFirst({
      where: { isActive: true }
    });

    if (existingActive) {
      console.log('⚠️  Ya existe una sesión activa:');
      console.log(`   Nombre: ${existingActive.name}`);
      console.log(`   Iniciada: ${existingActive.startedAt.toLocaleString()}`);
      console.log(`   ID: ${existingActive.id}\n`);
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        readline.question('¿Deseas crear una nueva sesión de todas formas? (y/n): ', (answer) => {
          readline.close();
          if (answer.toLowerCase() !== 'y') {
            console.log('❌ Operación cancelada');
            resolve();
            return;
          }
          
          // Cerrar la sesión activa actual
          prisma.escrutinioSession.update({
            where: { id: existingActive.id },
            data: { 
              isActive: false,
              isClosed: true,
              closedAt: new Date()
            }
          }).then(() => {
            console.log('✅ Sesión anterior cerrada');
            createNewSession().then(resolve);
          });
        });
      });
    } else {
      await createNewSession();
    }

  } catch (error) {
    console.error('❌ Error creando sesión:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function createNewSession() {
  // Obtener admin para asignar como creador
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!admin) {
    console.error('❌ No se encontró usuario admin');
    return;
  }

  // Crear nueva sesión
  const now = new Date();
  const sessionName = `Sesión ${now.toLocaleDateString('es-HN')} ${now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}`;

  const session = await prisma.escrutinioSession.create({
    data: {
      name: sessionName,
      description: 'Sesión de escrutinio activa',
      startedAt: now,
      isActive: true,
      isClosed: false,
      isTest: false
    }
  });

  console.log('✅ Nueva sesión creada:');
  console.log(`   Nombre: ${session.name}`);
  console.log(`   ID: ${session.id}`);
  console.log(`   Iniciada: ${session.startedAt.toLocaleString()}`);
  console.log(`   Estado: ACTIVA\n`);

  // Crear audit log
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'CREATE_SESSION',
      description: `Sesión creada: ${session.name}`,
      metadata: {
        sessionId: session.id,
        sessionName: session.name
      }
    }
  });

  console.log('📋 Los usuarios ahora pueden crear escrutinios en esta sesión.');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createActiveSession();
}

module.exports = { createActiveSession };

