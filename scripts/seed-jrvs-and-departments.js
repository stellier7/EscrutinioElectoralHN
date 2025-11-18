const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedDepartments() {
  console.log('🌱 Sembrando departamentos...');
  
  try {
    const diputadosData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'diputados-por-departamento.json'), 'utf8')
    );
    
    // Limpiar departamentos existentes
    await prisma.department.deleteMany({});
    
    // Crear departamentos
    for (const dept of diputadosData) {
      if (dept.department && dept.department !== 'Departamento no especificado' && dept.diputados > 0) {
        await prisma.department.create({
          data: {
            name: dept.department,
            code: dept.code,
            diputados: dept.diputados,
          }
        });
        console.log(`✅ Departamento creado: ${dept.department} (${dept.diputados} diputados)`);
      }
    }
    
    console.log(`✅ ${diputadosData.length} departamentos procesados`);
  } catch (error) {
    console.error('❌ Error sembrando departamentos:', error);
  }
}

async function seedJRVs() {
  console.log('🌱 Sembrando JRVs...');
  
  try {
    const jrvsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'jrvs.json'), 'utf8')
    );
    
    // Limpiar escrutinios y mesas existentes (en orden correcto para evitar restricciones FK)
    console.log('🧹 Limpiando escrutinios existentes...');
    await prisma.escrutinio.deleteMany({});
    
    console.log('🧹 Limpiando mesas existentes...');
    await prisma.mesa.deleteMany({});
    
    // Procesar JRVs en lotes para evitar problemas de memoria
    const batchSize = 1000;
    let processed = 0;
    
    for (let i = 0; i < jrvsData.length; i += batchSize) {
      const batch = jrvsData.slice(i, i + batchSize);
      
      const mesasToCreate = batch
        .filter(jrv => jrv.department && jrv.department !== 'Departamento no especificado')
        .map(jrv => ({
          number: jrv.number,
          location: jrv.location,
          address: jrv.address,
          department: jrv.department,
          municipality: jrv.municipality,
          area: jrv.area,
          cargaElectoral: jrv.cargaElectoral || jrv.electoralLoad,
          latitude: jrv.latitude,
          longitude: jrv.longitude,
        }));
      
      if (mesasToCreate.length > 0) {
        await prisma.mesa.createMany({
          data: mesasToCreate,
          skipDuplicates: true
        });
        
        processed += mesasToCreate.length;
        console.log(`📊 Procesadas ${processed}/${jrvsData.length} JRVs...`);
      }
    }
    
    console.log(`✅ ${processed} JRVs sembradas exitosamente`);
  } catch (error) {
    console.error('❌ Error sembrando JRVs:', error);
  }
}

async function main() {
  console.log('🚀 Iniciando proceso de siembra de datos...\n');
  
  try {
    await seedDepartments();
    console.log('');
    await seedJRVs();
    
    console.log('\n✅ Proceso de siembra completado exitosamente!');
    
    // Mostrar estadísticas finales
    const deptCount = await prisma.department.count();
    const mesaCount = await prisma.mesa.count();
    
    console.log('\n📊 Estadísticas finales:');
    console.log(`   Departamentos: ${deptCount}`);
    console.log(`   JRVs/Mesas: ${mesaCount}`);
    
  } catch (error) {
    console.error('❌ Error en el proceso de siembra:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { seedDepartments, seedJRVs };
