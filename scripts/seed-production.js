const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedProduction() {
  try {
    console.log('🌱 Starting production seed...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@escrutinio.com' },
      update: {
        deviceId: null, // Remove device association
      },
      create: {
        email: 'admin@escrutinio.com',
        password: adminPassword,
        name: 'Administrador del Sistema',
        role: 'ADMIN',
        deviceId: null, // No device association initially
      },
    });

    console.log('✅ Admin user created/updated:', adminUser.email);

    // Create auditor user
    const auditorPassword = await bcrypt.hash('auditor123', 12);
    
    const auditorUser = await prisma.user.upsert({
      where: { email: 'auditor@escrutinio.com' },
      update: {
        deviceId: null, // Remove device association
      },
      create: {
        email: 'auditor@escrutinio.com',
        password: auditorPassword,
        name: 'Auditor del Sistema',
        role: 'ADMIN', // Same role as admin for now
        deviceId: null, // No device association initially
      },
    });

    console.log('✅ Auditor user created/updated:', auditorUser.email);

    // Create election
    const election = await prisma.election.upsert({
      where: { id: 'election-2024' },
      update: {},
      create: {
        id: 'election-2024',
        name: 'Elecciones Generales 2024',
        description: 'Elecciones presidenciales, legislativas y municipales',
        startDate: new Date('2024-11-24T06:00:00Z'),
        endDate: new Date('2024-11-24T18:00:00Z'),
        isActive: true,
      },
    });

    console.log('✅ Election created/updated:', election.name);

    // Create presidential candidates (HN 2025) in required order
    const candidates = await Promise.all([
      prisma.candidate.upsert({
        where: { id: 'candidate-1' },
        update: {},
        create: {
          id: 'candidate-1',
          name: 'Mario Rivera',
          party: 'PDC',
          number: 1,
          electionLevel: 'PRESIDENTIAL',
          electionId: election.id,
        },
      }),
      prisma.candidate.upsert({
        where: { id: 'candidate-2' },
        update: {},
        create: {
          id: 'candidate-2',
          name: 'Rixi Moncada',
          party: 'LIBRE',
          number: 2,
          electionLevel: 'PRESIDENTIAL',
          electionId: election.id,
        },
      }),
      prisma.candidate.upsert({
        where: { id: 'candidate-3' },
        update: {},
        create: {
          id: 'candidate-3',
          name: 'Jorge Ávila',
          party: 'PINU-SD',
          number: 3,
          electionLevel: 'PRESIDENTIAL',
          electionId: election.id,
        },
      }),
      prisma.candidate.upsert({
        where: { id: 'candidate-4' },
        update: {},
        create: {
          id: 'candidate-4',
          name: 'Salvador Nasralla',
          party: 'PLH',
          number: 4,
          electionLevel: 'PRESIDENTIAL',
          electionId: election.id,
        },
      }),
      prisma.candidate.upsert({
        where: { id: 'candidate-5' },
        update: {},
        create: {
          id: 'candidate-5',
          name: 'Nasry Asfura',
          party: 'PNH',
          number: 5,
          electionLevel: 'PRESIDENTIAL',
          electionId: election.id,
        },
      }),
    ]);

    console.log('✅ Candidates created/updated:', candidates.length);

    // Create mesas
    const mesas = await Promise.all([
      prisma.mesa.upsert({
        where: { id: 'mesa-1' },
        update: {},
        create: {
          id: 'mesa-1',
          number: '001',
          location: 'Centro de Votación A',
          address: 'Calle Principal #123, Tegucigalpa',
          electionId: election.id,
        },
      }),
      prisma.mesa.upsert({
        where: { id: 'mesa-2' },
        update: {},
        create: {
          id: 'mesa-2',
          number: '002',
          location: 'Centro de Votación B',
          address: 'Avenida Central #456, San Pedro Sula',
          electionId: election.id,
        },
      }),
      prisma.mesa.upsert({
        where: { id: 'mesa-3' },
        update: {},
        create: {
          id: 'mesa-3',
          number: '003',
          location: 'Centro de Votación C',
          address: 'Boulevard Norte #789, La Ceiba',
          electionId: election.id,
        },
      }),
    ]);

    console.log('✅ Mesas created/updated:', mesas.length);

    // Create system config
    const systemConfig = await prisma.systemConfig.upsert({
      where: { id: 'main-config' },
      update: {},
      create: {
        id: 'main-config',
        key: 'system_status',
        value: 'active',
        description: 'System status configuration',
      },
    });

    console.log('✅ System config created/updated');

    console.log('🎉 Production seed completed successfully!');
    console.log('');
    console.log('📋 Credentials:');
    console.log('👤 Admin: admin@escrutinio.com / admin123');
    console.log('🔍 Auditor: auditor@escrutinio.com / auditor123');

  } catch (error) {
    console.error('❌ Error during production seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed if this file is executed directly
if (require.main === module) {
  seedProduction()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

module.exports = { seedProduction }; 