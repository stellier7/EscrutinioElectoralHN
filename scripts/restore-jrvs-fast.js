const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    data.push(row);
  }
  
  return data;
}

async function restoreJRVsFast() {
  try {
    console.log('🚀 Restauración RÁPIDA de JRVs...\n');

    const csvPath = path.join(__dirname, '..', 'jrvs-2025-revision.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ Archivo CSV no encontrado:', csvPath);
      process.exit(1);
    }

    console.log('📂 Leyendo archivo CSV...');
    const jrvs = await parseCSV(csvPath);
    console.log(`✅ ${jrvs.length} JRVs encontrados\n`);

    // Limpiar mesas existentes (más rápido que upsert)
    console.log('🧹 Limpiando mesas existentes...');
    await prisma.mesa.deleteMany({});
    console.log('✅ Mesas limpiadas');

    // Crear departamentos únicos
    console.log('\n📍 Creando departamentos...');
    const departments = [...new Set(jrvs.map(jrv => jrv.department))];
    
    for (const dept of departments) {
      if (!dept || dept === 'Departamento no especificado') continue;
      
      await prisma.department.upsert({
        where: { name: dept },
        update: {},
        create: {
          name: dept,
          code: parseInt(dept.substring(0, 2)) || 0,
          diputados: 0
        }
      });
    }
    console.log(`✅ ${departments.length} departamentos creados`);

    // Preparar datos para createMany
    console.log('\n🗳️  Preparando datos para inserción masiva...');
    const mesasData = jrvs
      .filter(jrv => jrv.number && jrv.department && jrv.department !== 'Departamento no especificado')
      .map(jrv => ({
        number: jrv.number,
        location: jrv.location || 'Sin ubicación',
        address: jrv.address || 'Sin dirección',
        department: jrv.department,
        municipality: jrv.municipality || 'Sin municipio',
        area: jrv.area || 'Sin área',
        electoralLoad: parseInt(jrv.electoralLoad) || 0,
      }));

    console.log(`📊 ${mesasData.length} JRVs preparados para inserción`);

    // Inserción masiva en lotes de 1000
    console.log('\n⚡ Insertando JRVs en lotes...');
    const batchSize = 1000;
    let totalInserted = 0;

    for (let i = 0; i < mesasData.length; i += batchSize) {
      const batch = mesasData.slice(i, i + batchSize);
      
      await prisma.mesa.createMany({
        data: batch,
        skipDuplicates: true
      });

      totalInserted += batch.length;
      const percentage = ((i + batch.length) / mesasData.length * 100).toFixed(1);
      process.stdout.write(`\r   Progreso: ${percentage}% (${totalInserted}/${mesasData.length})`);
    }

    console.log('\n');
    console.log('✅ Restauración completada!\n');
    console.log('📊 RESUMEN:');
    console.log(`   JRVs insertados: ${totalInserted}`);
    console.log(`   Total en base de datos: ${await prisma.mesa.count()}`);

  } catch (error) {
    console.error('\n❌ Error restaurando JRVs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  restoreJRVsFast();
}

module.exports = { restoreJRVsFast };
