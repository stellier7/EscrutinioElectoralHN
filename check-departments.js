const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDepartments() {
  try {
    console.log('🔍 Verificando departamentos en la base de datos...');
    
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        diputados: true,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`📊 Total de departamentos encontrados: ${departments.length}`);
    
    if (departments.length === 0) {
      console.log('❌ No hay departamentos en la base de datos');
      return;
    }

    console.log('\n📋 Departamentos:');
    departments.forEach(dept => {
      console.log(`- ${dept.name} (${dept.code}): ${dept.diputados} diputados`);
    });

    // Buscar específicamente el departamento de la JRV 01234 (02-COLON)
    const colonDept = await prisma.department.findFirst({
      where: {
        OR: [
          { name: { contains: 'COLON', mode: 'insensitive' } },
          { code: { contains: '02', mode: 'insensitive' } }
        ]
      }
    });

    if (colonDept) {
      console.log(`\n✅ Departamento Colón encontrado:`, colonDept);
    } else {
      console.log('\n❌ Departamento Colón NO encontrado');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDepartments();
