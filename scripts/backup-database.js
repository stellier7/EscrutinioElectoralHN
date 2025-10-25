const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const backupDir = path.join(__dirname, '..', 'backups');
    
    // Crear directorio de backups si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('💾 Iniciando backup de base de datos...\n');

    // 1. Backup JSON (legible, portable)
    console.log('📝 Creando backup JSON...');
    const jsonBackup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    // Tablas críticas a respaldar
    const tables = [
      'user',
      'escrutinio',
      'escrutinioSession',
      'vote',
      'mesa',
      'department',
      'candidate',
      'election',
      'auditLog',
      'escrutinioCheckpoint',
      'correction',
      'papeleta'
    ];

    for (const table of tables) {
      try {
        const data = await prisma[table].findMany();
        jsonBackup.data[table] = data;
        console.log(`   ✅ ${table}: ${data.length} registros`);
      } catch (error) {
        console.log(`   ⚠️  ${table}: tabla no existe o error`);
      }
    }

    const jsonPath = path.join(backupDir, `backup-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonBackup, null, 2));
    console.log(`\n✅ Backup JSON creado: ${jsonPath}`);

    // 2. Backup SQL (si DATABASE_URL está disponible)
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl) {
        console.log('\n📝 Creando backup SQL...');
        const sqlPath = path.join(backupDir, `backup-${timestamp}.sql`);
        
        // Extraer info de conexión
        const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
        if (urlMatch) {
          const [, user, password, host, port, database] = urlMatch;
          
          // Usar pg_dump para crear backup SQL
          const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f "${sqlPath}"`;
          execSync(command, { stdio: 'ignore' });
          
          console.log(`✅ Backup SQL creado: ${sqlPath}`);
        }
      }
    } catch (error) {
      console.log('⚠️  No se pudo crear backup SQL (pg_dump no disponible o error de conexión)');
    }

    // Resumen
    console.log('\n📊 RESUMEN DEL BACKUP:');
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Ubicación: ${backupDir}`);
    console.log(`   Archivos creados:`);
    console.log(`      - backup-${timestamp}.json`);
    
    // Listar backups existentes
    const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-'));
    console.log(`\n📁 Total de backups: ${backups.length}`);
    
    // Limpiar backups antiguos (mantener últimos 10)
    if (backups.length > 10) {
      const sorted = backups.sort().reverse();
      const toDelete = sorted.slice(10);
      console.log(`\n🧹 Limpiando ${toDelete.length} backups antiguos...`);
      toDelete.forEach(file => {
        fs.unlinkSync(path.join(backupDir, file));
      });
    }

    console.log('\n✅ Backup completado exitosamente!');
    return jsonPath;

  } catch (error) {
    console.error('❌ Error creando backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  backupDatabase();
}

module.exports = { backupDatabase };

