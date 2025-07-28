import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@escrutinio.com' },
    update: {},
    create: {
      email: 'admin@escrutinio.com',
      password: hashedPassword,
      name: 'Administrador del Sistema',
      role: 'ADMIN',
      deviceId: 'admin-device-001',
    },
  });

  console.log('✅ Admin user created:', adminUser.email);

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

  console.log('✅ Auditor user created:', auditorUser.email);

  // Create sample election
  const election = await prisma.election.upsert({
    where: { id: 'election-2024' },
    update: {},
    create: {
      id: 'election-2024',
      name: 'Elecciones Generales 2024',
      description: 'Elecciones presidenciales, legislativas y municipales',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      isActive: true,
    },
  });

  console.log('✅ Election created:', election.name);

  // Create sample candidates
  const candidates = [
    // Presidenciales
    { name: 'Juan Pérez', party: 'Partido A', number: 1, level: 'PRESIDENTIAL' },
    { name: 'María García', party: 'Partido B', number: 2, level: 'PRESIDENTIAL' },
    { name: 'Carlos López', party: 'Partido C', number: 3, level: 'PRESIDENTIAL' },
    
    // Legislativos
    { name: 'Ana Rodríguez', party: 'Partido A', number: 101, level: 'LEGISLATIVE' },
    { name: 'Pedro Martínez', party: 'Partido B', number: 102, level: 'LEGISLATIVE' },
    { name: 'Laura González', party: 'Partido C', number: 103, level: 'LEGISLATIVE' },
    
    // Municipales
    { name: 'Roberto Silva', party: 'Partido A', number: 201, level: 'MUNICIPAL' },
    { name: 'Carmen Díaz', party: 'Partido B', number: 202, level: 'MUNICIPAL' },
    { name: 'Miguel Torres', party: 'Partido C', number: 203, level: 'MUNICIPAL' },
  ];

  for (const candidate of candidates) {
    await prisma.candidate.upsert({
      where: {
        electionId_number_electionLevel: {
          electionId: election.id,
          number: candidate.number,
          electionLevel: candidate.level as any,
        },
      },
      update: {},
      create: {
        name: candidate.name,
        party: candidate.party,
        number: candidate.number,
        electionId: election.id,
        electionLevel: candidate.level as any,
      },
    });
  }

  console.log('✅ Candidates created');

  // Create sample mesas
  const mesas = [
    { number: 'JRV-001', location: 'Escuela Central', address: 'Av. Principal 123', lat: -12.0464, lng: -77.0428 },
    { number: 'JRV-002', location: 'Colegio San José', address: 'Jr. Lima 456', lat: -12.0565, lng: -77.0328 },
    { number: 'JRV-003', location: 'Centro Comunal', address: 'Plaza Mayor s/n', lat: -12.0664, lng: -77.0228 },
    { number: 'JRV-004', location: 'Universidad Local', address: 'Av. Universidad 789', lat: -12.0764, lng: -77.0128 },
    { number: 'JRV-005', location: 'Club Deportivo', address: 'Jr. Deporte 321', lat: -12.0864, lng: -77.0028 },
  ];

  for (const mesa of mesas) {
    await prisma.mesa.upsert({
      where: { number: mesa.number },
      update: {},
      create: {
        number: mesa.number,
        location: mesa.location,
        address: mesa.address,
        latitude: mesa.lat,
        longitude: mesa.lng,
      },
    });
  }

  console.log('✅ Mesas created');

  // Create system configurations
  const configs = [
    { key: 'MAX_UPLOAD_SIZE', value: '10485760', description: 'Maximum file upload size in bytes (10MB)' },
    { key: 'ALLOWED_IMAGE_TYPES', value: 'image/jpeg,image/png,image/jpg', description: 'Allowed image MIME types' },
    { key: 'SESSION_TIMEOUT', value: '3600', description: 'Session timeout in seconds (1 hour)' },
    { key: 'MAX_LOGIN_ATTEMPTS', value: '5', description: 'Maximum login attempts before lockout' },
    { key: 'GEOLOCATION_ACCURACY', value: '100', description: 'Required GPS accuracy in meters' },
    { key: 'AUDIT_RETENTION_DAYS', value: '90', description: 'Audit log retention period in days' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }

  console.log('✅ System configurations created');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 