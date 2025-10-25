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

async function restoreJRVs() {
  try {
    console.log('🔄 Iniciando restauración de JRVs desde CSV...\n');

    const csvPath = path.join(__dirname, '..', 'jrvs-2025-revision.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ Archivo CSV no encontrado:', csvPath);
      process.exit(1);
    }

    console.log('📂 Leyendo archivo CSV...');
    const jrvs = await parseCSV(csvPath);
    console.log(`✅ ${jrvs.length} JRVs encontrados en el archivo\n`);

    // Verificar estado actual
    const currentCount = await prisma.mesa.count();
    console.log(`📊 Mesas actuales en base de datos: ${currentCount}`);

    if (currentCount > 0) {
      console.log('\n⚠️  ADVERTENCIA: Ya existen mesas en la base de datos.');
      console.log('Este script usará UPSERT (actualizar o crear) para no perder datos.\n');
    }

    // Verificar que existe una elección activa (no es necesaria para crear mesas)
    const election = await prisma.election.findFirst({
      where: { isActive: true }
    });

    if (election) {
      console.log('✅ Elección activa encontrada:', election.name);
    } else {
      console.log('⚠️  No hay elección activa (se puede crear después)');
    }

    // Crear departamentos únicos
    console.log('\n📍 Procesando departamentos...');
    const departments = [...new Set(jrvs.map(jrv => jrv.department))];
    
    for (const dept of departments) {
      if (!dept || dept === 'Departamento no especificado') continue;
      
      await prisma.department.upsert({
        where: { name: dept },
        update: {},
        create: {
          name: dept,
          code: parseInt(dept.substring(0, 2)) || 0,
          diputados: 0 // Se puede actualizar después
        }
      });
    }
    console.log(`✅ ${departments.length} departamentos procesados`);

    // Restaurar JRVs en lotes
    console.log('\n🗳️  Restaurando JRVs...');
    const batchSize = 500;
    let processed = 0;
    let created = 0;
    let updated = 0;

    for (let i = 0; i < jrvs.length; i += batchSize) {
      const batch = jrvs.slice(i, i + batchSize);
      
      for (const jrv of batch) {
        if (!jrv.number || !jrv.department || jrv.department === 'Departamento no especificado') {
          continue;
        }

        const result = await prisma.mesa.upsert({
          where: { number: jrv.number },
          update: {
            location: jrv.location || 'Sin ubicación',
            address: jrv.address || 'Sin dirección',
            department: jrv.department,
            municipality: jrv.municipality || 'Sin municipio',
            area: jrv.area || 'Sin área',
            electoralLoad: parseInt(jrv.electoralLoad) || 0,
          },
          create: {
            number: jrv.number,
            location: jrv.location || 'Sin ubicación',
            address: jrv.address || 'Sin dirección',
            department: jrv.department,
            municipality: jrv.municipality || 'Sin municipio',
            area: jrv.area || 'Sin área',
            electoralLoad: parseInt(jrv.electoralLoad) || 0,
          }
        });

        // Determinar si fue creado o actualizado
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }

        processed++;
      }

      // Mostrar progreso
      const percentage = ((i + batch.length) / jrvs.length * 100).toFixed(1);
      process.stdout.write(`\r   Progreso: ${percentage}% (${processed}/${jrvs.length})`);
    }

    console.log('\n');
    console.log('✅ Restauración completada!\n');
    console.log('📊 RESUMEN:');
    console.log(`   JRVs procesados: ${processed}`);
    console.log(`   JRVs creados: ${created}`);
    console.log(`   JRVs actualizados: ${updated}`);
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
  restoreJRVs();
}

module.exports = { restoreJRVs };

