const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function restoreFromBackup(backupFile) {
  try {
    console.log('🔄 Iniciando restauración desde backup...\n');

    if (!backupFile) {
      // Listar backups disponibles
      const backupDir = path.join(__dirname, '..', 'backups');
      if (!fs.existsSync(backupDir)) {
        console.error('❌ No hay backups disponibles');
        return;
      }

      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-'))
        .sort()
        .reverse();

      if (backups.length === 0) {
        console.error('❌ No hay backups disponibles');
        return;
      }

      console.log('📁 Backups disponibles:');
      backups.forEach((backup, index) => {
        const stats = fs.statSync(path.join(backupDir, backup));
        console.log(`   ${index + 1}. ${backup} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      });

      console.log('\nUso: node scripts/restore-from-backup.js <archivo>');
      console.log('Ejemplo: node scripts/restore-from-backup.js backups/backup-2025-01-10T15-30-00.json');
      return;
    }

    const backupPath = path.isAbsolute(backupFile) ? backupFile : path.join(__dirname, '..', backupFile);

    if (!fs.existsSync(backupPath)) {
      console.error('❌ Archivo de backup no encontrado:', backupPath);
      return;
    }

    const ext = path.extname(backupPath);

    if (ext === '.json') {
      await restoreFromJSON(backupPath);
    } else if (ext === '.sql') {
      await restoreFromSQL(backupPath);
    } else {
      console.error('❌ Formato de backup no soportado. Use .json o .sql');
    }

  } catch (error) {
    console.error('❌ Error restaurando backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function restoreFromJSON(jsonPath) {
  console.log('📝 Restaurando desde backup JSON...\n');

  const backup = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📅 Backup creado: ${backup.timestamp}`);
  console.log(`📦 Versión: ${backup.version}\n`);

  // Orden de restauración (respetando dependencias)
  const restoreOrder = [
    'user',
    'election',
    'department',
    'mesa',
    'candidate',
    'escrutinioSession',
    'escrutinio',
    'vote',
    'escrutinioCheckpoint',
    'correction',
    'papeleta',
    'auditLog'
  ];

  for (const table of restoreOrder) {
    if (!backup.data[table]) continue;

    const records = backup.data[table];
    console.log(`🔄 Restaurando ${table}: ${records.length} registros...`);

    try {
      for (const record of records) {
        // Convertir fechas de string a Date
        Object.keys(record).forEach(key => {
          if (typeof record[key] === 'string' && record[key].match(/^\d{4}-\d{2}-\d{2}T/)) {
            record[key] = new Date(record[key]);
          }
        });

        // Usar upsert cuando sea posible
        if (record.id) {
          await prisma[table].upsert({
            where: { id: record.id },
            update: record,
            create: record
          });
        } else {
          await prisma[table].create({ data: record });
        }
      }
      console.log(`   ✅ ${table} restaurado`);
    } catch (error) {
      console.log(`   ⚠️  Error en ${table}:`, error.message);
    }
  }

  console.log('\n✅ Restauración completada!');
}

async function restoreFromSQL(sqlPath) {
  console.log('📝 Restaurando desde backup SQL...\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL no configurada');
    return;
  }

  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!urlMatch) {
    console.error('❌ DATABASE_URL inválida');
    return;
  }

  const [, user, password, host, port, database] = urlMatch;

  console.log('⚠️  ADVERTENCIA: Esto sobrescribirá TODA la base de datos actual.');
  console.log('Presiona Ctrl+C para cancelar o Enter para continuar...');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('', () => {
      readline.close();
      resolve();
    });
  });

  try {
    const command = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -d ${database} -f "${sqlPath}"`;
    execSync(command, { stdio: 'inherit' });
    console.log('\n✅ Restauración SQL completada!');
  } catch (error) {
    console.error('❌ Error ejecutando restauración SQL:', error.message);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const backupFile = process.argv[2];
  restoreFromBackup(backupFile);
}

module.exports = { restoreFromBackup };

