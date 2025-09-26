const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkJRVs() {
  try {
    console.log('🔍 Verificando JRVs en la base de datos...');
    
    const mesas = await prisma.mesa.findMany({
      select: {
        id: true,
        number: true,
        location: true,
        department: true,
        municipality: true,
        isActive: true
      },
      orderBy: {
        number: 'asc'
      }
    });

    console.log(`📊 Total de mesas encontradas: ${mesas.length}`);
    
    if (mesas.length === 0) {
      console.log('❌ No hay mesas en la base de datos');
      return;
    }

    console.log('\n📋 Primeras 10 JRVs:');
    mesas.slice(0, 10).forEach(mesa => {
      console.log(`- ${mesa.number}: ${mesa.location} (${mesa.department})`);
    });

    // Buscar específicamente la JRV 01234
    const jrv01234 = await prisma.mesa.findFirst({
      where: {
        number: {
          contains: '01234',
          mode: 'insensitive'
        }
      }
    });

    if (jrv01234) {
      console.log(`\n✅ JRV 01234 encontrada:`, jrv01234);
    } else {
      console.log('\n❌ JRV 01234 NO encontrada');
      
      // Buscar JRVs similares
      const similarJRVs = await prisma.mesa.findMany({
        where: {
          number: {
            contains: '1234',
            mode: 'insensitive'
          }
        }
      });
      
      if (similarJRVs.length > 0) {
        console.log('🔍 JRVs similares encontradas:');
        similarJRVs.forEach(jrv => {
          console.log(`- ${jrv.number}: ${jrv.location}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJRVs();
