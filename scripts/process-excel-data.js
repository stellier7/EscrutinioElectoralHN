const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Función para procesar el archivo de JRVs
function processJRVsFile() {
  try {
    const filePath = path.join(__dirname, '..', 'JRVs 2021.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Primera hoja
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Datos de JRVs encontrados:', data.length, 'registros');
    console.log('Primeras 3 filas:', data.slice(0, 3));
    
    // Procesar y limpiar datos
    const processedJRVs = data.map((row, index) => {
      // Mapear columnas según la estructura real del Excel
      const jrv = {
        id: `jrv-${index + 1}`,
        number: row[' NÚMERO DE JRV']?.toString().trim() || `JRV-${String(index + 1).padStart(3, '0')}`,
        location: row['CENTRO_VOTACION']?.toString().trim() || 'Ubicación no especificada',
        address: row['SECTOR_ELECTORAL']?.toString().trim() || null,
        department: row['DEPARTAMENTO']?.toString().trim() || 'Departamento no especificado',
        municipality: row['MUNICIPIO']?.toString().trim() || null,
        area: row['AREA']?.toString().trim() || null,
        electoralLoad: row['CARGA \r\nELECTORAL'] || null,
        latitude: null, // No disponible en el Excel
        longitude: null, // No disponible en el Excel
      };
      
      return jrv;
    });
    
    return processedJRVs;
  } catch (error) {
    console.error('Error procesando archivo JRVs:', error.message);
    return [];
  }
}

// Función para procesar el archivo de Diputados por Departamento
function processDiputadosFile() {
  try {
    const filePath = path.join(__dirname, '..', 'Diputados por Departamento.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Primera hoja
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Datos de Diputados por Departamento encontrados:', data.length, 'registros');
    console.log('Primeras 3 filas:', data.slice(0, 3));
    
    // Procesar y limpiar datos
    const processedDiputados = data
      .filter((row, index) => index > 0 && row['__EMPTY_1']) // Filtrar header y filas vacías
      .map((row, index) => {
        const diputado = {
          id: `diputado-${index}`,
          department: row['__EMPTY_1']?.toString().trim() || 'Departamento no especificado',
          diputados: parseInt(row['__EMPTY_2']) || 0,
          code: parseInt(row['__EMPTY']) || null,
        };
        
        return diputado;
      });
    
    return processedDiputados;
  } catch (error) {
    console.error('Error procesando archivo Diputados:', error.message);
    return [];
  }
}

// Función principal
function main() {
  console.log('=== Procesando archivos Excel ===\n');
  
  // Procesar JRVs
  console.log('1. Procesando JRVs 2021.xlsx...');
  const jrvs = processJRVsFile();
  
  // Procesar Diputados
  console.log('\n2. Procesando Diputados por Departamento.xlsx...');
  const diputados = processDiputadosFile();
  
  // Crear archivos JSON con los datos procesados
  const outputDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Guardar JRVs
  fs.writeFileSync(
    path.join(outputDir, 'jrvs.json'),
    JSON.stringify(jrvs, null, 2)
  );
  
  // Guardar Diputados
  fs.writeFileSync(
    path.join(outputDir, 'diputados-por-departamento.json'),
    JSON.stringify(diputados, null, 2)
  );
  
  console.log('\n=== Resumen ===');
  console.log(`JRVs procesadas: ${jrvs.length}`);
  console.log(`Departamentos con diputados: ${diputados.length}`);
  
  // Mostrar departamentos únicos
  const departamentos = [...new Set(jrvs.map(jrv => jrv.department))];
  console.log(`Departamentos únicos en JRVs: ${departamentos.length}`);
  console.log('Departamentos:', departamentos.slice(0, 10).join(', '), departamentos.length > 10 ? '...' : '');
  
  // Mostrar distribución de diputados
  console.log('\nDistribución de diputados por departamento:');
  diputados.forEach(d => {
    console.log(`  ${d.department}: ${d.diputados} diputados`);
  });
  
  console.log('\n✅ Archivos procesados y guardados en /data/');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { processJRVsFile, processDiputadosFile };
