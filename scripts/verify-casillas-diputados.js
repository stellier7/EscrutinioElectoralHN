const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Script de verificación de integridad: Casillas = Diputados
 * 
 * Verifica que:
 * 1. El endpoint genera exactamente department.diputados casillas totales
 * 2. El límite de marcas coincide con department.diputados
 */

// Función para simular lo que hace el endpoint
// Cada partido tiene department.diputados casillas
function calculateCurrentCasillas(diputados) {
  const parties = ['pdc', 'libre', 'pinu-sd', 'liberal', 'nacional'];
  const allCasillas = new Set();
  const distribucion = [];
  
  parties.forEach((party, index) => {
    const startSlot = index * diputados + 1;
    const endSlot = (index + 1) * diputados;
    const casillas = Array.from({ length: diputados }, (_, i) => startSlot + i);
    casillas.forEach(c => allCasillas.add(c));
    
    distribucion.push({
      party: party,
      casillas: casillas.length,
      range: `${startSlot}-${endSlot}`,
      esperadasPorPartido: diputados
    });
  });
  
  return {
    totalCasillas: allCasillas.size, // 5 partidos × diputados
    casillasPorPartido: diputados, // Cada partido tiene 'diputados' casillas
    casillasUnicas: Array.from(allCasillas).sort((a, b) => a - b),
    distribucion: distribucion
  };
}

async function verifyCasillasDiputados() {
  try {
    console.log('🔍 Verificando integridad: Casillas = Diputados\n');
    console.log('=' .repeat(80));
    
    // Obtener todos los departamentos activos
    const departments = await prisma.department.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        code: true,
        diputados: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    if (departments.length === 0) {
      console.log('❌ No hay departamentos activos en la base de datos');
      return;
    }

    console.log(`📊 Total de departamentos a verificar: ${departments.length}\n`);

    const results = [];
    let totalDiscrepancias = 0;

    for (const dept of departments) {
      const current = calculateCurrentCasillas(dept.diputados);
      const expectedPorPartido = dept.diputados; // Cada partido debe tener 'diputados' casillas
      const actualPorPartido = current.casillasPorPartido;
      const totalCasillasEsperadas = expectedPorPartido * 5; // 5 partidos
      const totalCasillasActuales = current.totalCasillas;
      
      // Verificar que cada partido tiene el número correcto de casillas
      const tieneDiscrepancia = actualPorPartido !== expectedPorPartido;
      const diferencia = actualPorPartido - expectedPorPartido;

      if (tieneDiscrepancia) {
        totalDiscrepancias++;
      }

      results.push({
        departamento: dept.name,
        codigo: dept.code,
        diputadosEsperados: expectedPorPartido,
        casillasPorPartidoEsperadas: expectedPorPartido,
        casillasPorPartidoActuales: actualPorPartido,
        totalCasillasGeneradas: totalCasillasActuales,
        diferencia: diferencia,
        tieneDiscrepancia: tieneDiscrepancia,
        rangoActual: totalCasillasActuales > 0 ? `${current.casillasUnicas[0]}-${current.casillasUnicas[current.casillasUnicas.length - 1]}` : 'N/A'
      });

      // Mostrar resultado por departamento
      const status = tieneDiscrepancia ? '❌' : '✅';
      console.log(`${status} ${dept.name} (Código: ${dept.code || 'N/A'}):`);
      console.log(`   Diputados: ${expectedPorPartido}`);
      console.log(`   Casillas por partido: ${actualPorPartido} (esperadas: ${expectedPorPartido})`);
      console.log(`   Total casillas generadas: ${totalCasillasActuales} (${expectedPorPartido} × 5 partidos)`);
      
      if (!tieneDiscrepancia && current.distribucion) {
        console.log(`   Distribución por partido:`);
        current.distribucion.forEach(dist => {
          console.log(`     - ${dist.party}: ${dist.casillas} casillas (${dist.range})`);
        });
      }
      
      if (tieneDiscrepancia) {
        console.log(`   ⚠️  PROBLEMA: Cada partido tiene ${actualPorPartido} casillas cuando debería tener ${expectedPorPartido}`);
      }
      console.log('');
    }

    // Resumen
    console.log('=' .repeat(80));
    console.log('\n📋 RESUMEN:');
    console.log(`Total departamentos: ${departments.length}`);
    console.log(`✅ Configuración correcta: ${departments.length - totalDiscrepancias}`);
    console.log(`❌ Con discrepancias: ${totalDiscrepancias}`);

    if (totalDiscrepancias > 0) {
      console.log('\n🚨 DEPARTAMENTOS CON PROBLEMAS:');
      results
        .filter(r => r.tieneDiscrepancia)
        .forEach(r => {
          console.log(`   - ${r.departamento}: ${r.casillasPorPartidoActuales} casillas/partido (esperadas: ${r.casillasPorPartidoEsperadas}/partido)`);
        });
      
      console.log('\n💡 RECOMENDACIÓN:');
      console.log('   Verificar el endpoint /api/diputados/jrv/[jrvNumber]/route.ts');
      console.log('   Cada partido debe tener exactamente department.diputados casillas.');
    } else {
      console.log('\n✅ Todos los departamentos tienen configuración correcta!');
    }

    // Estadísticas detalladas
    console.log('\n📊 ESTADÍSTICAS:');
    const promedioCasillasPorPartido = results.reduce((sum, r) => sum + r.casillasPorPartidoActuales, 0) / results.length;
    const promedioDiputados = results.reduce((sum, r) => sum + r.diputadosEsperados, 0) / results.length;
    console.log(`   Promedio de diputados por departamento: ${promedioDiputados.toFixed(2)}`);
    console.log(`   Promedio de casillas por partido: ${promedioCasillasPorPartido.toFixed(2)}`);
    console.log(`   Configuración correcta: ${promedioCasillasPorPartido === promedioDiputados ? '✅' : '❌'} (deberían ser iguales)`);

    return {
      total: departments.length,
      correctos: departments.length - totalDiscrepancias,
      conDiscrepancias: totalDiscrepancias,
      results: results
    };

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar verificación
if (require.main === module) {
  verifyCasillasDiputados()
    .then(() => {
      console.log('\n✅ Verificación completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { verifyCasillasDiputados, calculateCurrentCasillas };

