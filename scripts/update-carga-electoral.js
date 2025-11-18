const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Manejar valores que pueden contener comas dentro de comillas
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Último valor
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    data.push(row);
  }
  
  return data;
}

async function updateCargaElectoral() {
  try {
    console.log('⚡ Actualizando Carga Electoral desde CSV...\n');

    // Buscar el CSV correcto
    const csvFiles = [
      'Desglose_Ejecutivo_JRV_Individuales_2025.csv',
      'Resumen_Ejecutivo_JRV_2025.csv',
      'jrvs-2025-revision.csv'
    ];
    
    let csvPath = null;
    for (const file of csvFiles) {
      const testPath = path.join(__dirname, '..', file);
      if (fs.existsSync(testPath)) {
        csvPath = testPath;
        console.log(`📂 Usando archivo: ${file}`);
        break;
      }
    }
    
    if (!csvPath) {
      console.error('❌ No se encontró ningún archivo CSV válido');
      console.error('   Buscando:', csvFiles.join(', '));
      process.exit(1);
    }

    console.log('📂 Leyendo archivo CSV...');
    const rows = await parseCSV(csvPath);
    console.log(`✅ ${rows.length} filas encontradas\n`);

    // Mostrar headers para debug
    if (rows.length > 0) {
      console.log('📋 Columnas encontradas:', Object.keys(rows[0]).join(', '));
    }
    
    // Crear mapa JRV -> Carga Electoral
    const cargaElectoralMap = new Map();
    
    for (const row of rows) {
      // Buscar columna JRV - puede ser "JRV" exacto o variaciones
      let jrvKey = null;
      const possibleJRVKeys = ['JRV', 'jrv', 'Jrv', 'JRV Number', 'JRV_NUMBER'];
      for (const key of possibleJRVKeys) {
        if (row.hasOwnProperty(key)) {
          jrvKey = key;
          break;
        }
      }
      
      // Si no se encuentra, buscar por nombre parcial
      if (!jrvKey) {
        jrvKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('jrv') && !key.toLowerCase().includes('carga')
        );
      }
      
      // Buscar columna Carga Electoral - puede ser "Carga Electoral" exacto
      let cargaKey = null;
      const possibleCargaKeys = ['Carga Electoral', 'CARGA ELECTORAL', 'carga electoral', 'CargaElectoral', 'CARGA_ELECTORAL'];
      for (const key of possibleCargaKeys) {
        if (row.hasOwnProperty(key)) {
          cargaKey = key;
          break;
        }
      }
      
      // Si no se encuentra, buscar por nombre parcial
      if (!cargaKey) {
        cargaKey = Object.keys(row).find(key => 
          (key.toLowerCase().includes('carga') && key.toLowerCase().includes('electoral')) ||
          (key.toLowerCase() === 'carga' || key.toLowerCase() === 'electoral')
        );
      }
      
      if (!jrvKey || !cargaKey) {
        continue;
      }
      
      const jrvNumber = String(row[jrvKey] || '').trim();
      const cargaElectoralStr = String(row[cargaKey] || '').trim();
      const cargaElectoral = parseInt(cargaElectoralStr);
      
      if (!jrvNumber || isNaN(cargaElectoral) || cargaElectoral === 0) {
        continue;
      }
      
      // Normalizar número de JRV a 5 dígitos
      const normalizedJRV = jrvNumber.padStart(5, '0');
      
      // Si ya existe, usar el mayor valor (por si hay duplicados)
      if (cargaElectoralMap.has(normalizedJRV)) {
        const existing = cargaElectoralMap.get(normalizedJRV);
        if (cargaElectoral > existing) {
          cargaElectoralMap.set(normalizedJRV, cargaElectoral);
        }
      } else {
        cargaElectoralMap.set(normalizedJRV, cargaElectoral);
      }
    }
    
    console.log(`📊 ${cargaElectoralMap.size} JRVs con carga electoral encontradas\n`);
    
    if (cargaElectoralMap.size === 0) {
      console.error('❌ No se encontraron datos de carga electoral válidos');
      process.exit(1);
    }

    // Actualizar base de datos
    console.log('🔄 Actualizando base de datos...\n');
    const batchSize = 500;
    let updated = 0;
    let notFound = 0;
    let errors = 0;
    
    const jrvNumbers = Array.from(cargaElectoralMap.keys());
    
    for (let i = 0; i < jrvNumbers.length; i += batchSize) {
      const batch = jrvNumbers.slice(i, i + batchSize);
      
      for (const jrvNumber of batch) {
        try {
          const cargaElectoral = cargaElectoralMap.get(jrvNumber);
          
          const result = await prisma.mesa.updateMany({
            where: { number: jrvNumber },
            data: { cargaElectoral: cargaElectoral }
          });
          
          if (result.count > 0) {
            updated++;
          } else {
            notFound++;
            console.log(`⚠️  JRV ${jrvNumber} no encontrada en BD`);
          }
        } catch (error) {
          errors++;
          console.error(`❌ Error actualizando JRV ${jrvNumber}:`, error.message);
        }
      }
      
      // Mostrar progreso
      const percentage = ((Math.min(i + batchSize, jrvNumbers.length)) / jrvNumbers.length * 100).toFixed(1);
      process.stdout.write(`\r   Progreso: ${percentage}% (${Math.min(i + batchSize, jrvNumbers.length)}/${jrvNumbers.length})`);
    }

    console.log('\n');
    console.log('✅ Actualización completada!\n');
    console.log('📊 RESUMEN:');
    console.log(`   JRVs actualizadas: ${updated}`);
    console.log(`   JRVs no encontradas: ${notFound}`);
    console.log(`   Errores: ${errors}`);
    
    // Verificar resultado
    const totalWithCarga = await prisma.mesa.count({
      where: { 
        cargaElectoral: { not: null },
        NOT: { cargaElectoral: 0 }
      }
    });
    console.log(`   Total JRVs con carga electoral en BD: ${totalWithCarga}`);

  } catch (error) {
    console.error('\n❌ Error actualizando carga electoral:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  updateCargaElectoral()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script falló:', error);
      process.exit(1);
    });
}

module.exports = { updateCargaElectoral };

