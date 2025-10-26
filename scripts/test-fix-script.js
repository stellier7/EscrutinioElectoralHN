#!/usr/bin/env node

/**
 * Script de prueba para verificar el script de reparación de checkpoints
 * 
 * Este script:
 * 1. Verifica que el script de reparación se puede ejecutar sin errores
 * 2. Muestra información sobre escrutinios presidenciales existentes
 * 3. No modifica datos, solo hace un dry-run
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFixScript() {
  console.log('🧪 Iniciando prueba del script de reparación...\n');

  try {
    // 1. Verificar conexión a la base de datos
    console.log('🔌 Verificando conexión a la base de datos...');
    await prisma.$connect();
    console.log('✅ Conexión exitosa\n');

    // 2. Contar escrutinios presidenciales
    const totalEscrutinios = await prisma.escrutinio.count({
      where: {
        electionLevel: 'PRESIDENTIAL'
      }
    });
    console.log(`📊 Total de escrutinios presidenciales: ${totalEscrutinios}`);

    const closedEscrutinios = await prisma.escrutinio.count({
      where: {
        electionLevel: 'PRESIDENTIAL',
        status: 'CLOSED'
      }
    });
    console.log(`📊 Escrutinios cerrados: ${closedEscrutinios}\n`);

    // 3. Verificar checkpoints
    const totalCheckpoints = await prisma.escrutinioCheckpoint.count({
      where: {
        action: 'FREEZE'
      }
    });
    console.log(`📊 Total de checkpoints FREEZE: ${totalCheckpoints}\n`);

    // 4. Analizar algunos escrutinios de ejemplo
    console.log('🔍 Analizando escrutinios de ejemplo...\n');
    
    const sampleEscrutinios = await prisma.escrutinio.findMany({
      where: {
        electionLevel: 'PRESIDENTIAL',
        status: 'CLOSED'
      },
      include: {
        votes: {
          include: {
            candidate: true
          }
        },
        checkpoints: {
          where: {
            action: 'FREEZE'
          },
          orderBy: {
            timestamp: 'desc'
          },
          take: 1
        },
        mesa: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      take: 3
    });

    for (const escrutinio of sampleEscrutinios) {
      console.log(`📋 Escrutinio ${escrutinio.id} (JRV ${escrutinio.mesa.number}):`);
      console.log(`   👤 Usuario: ${escrutinio.user.name}`);
      console.log(`   📅 Completado: ${escrutinio.completedAt?.toISOString()}`);
      console.log(`   🗳️  Votos en DB: ${escrutinio.votes.length}`);
      
      // Calcular votos correctos
      const correctVotes = {};
      let totalCorrectVotes = 0;
      escrutinio.votes.forEach(vote => {
        const candidateId = vote.candidateId;
        if (!correctVotes[candidateId]) {
          correctVotes[candidateId] = {
            name: vote.candidate.name,
            party: vote.candidate.party,
            votes: 0
          };
        }
        correctVotes[candidateId].votes += vote.count;
        totalCorrectVotes += vote.count;
      });
      
      console.log(`   📊 Total votos correctos: ${totalCorrectVotes}`);
      console.log(`   📋 Candidatos con votos: ${Object.keys(correctVotes).length}`);
      
      if (escrutinio.checkpoints.length > 0) {
        const checkpoint = escrutinio.checkpoints[0];
        const checkpointVotes = checkpoint.votesSnapshot || {};
        const totalCheckpointVotes = Object.values(checkpointVotes).reduce((sum: number, count: any) => sum + count, 0);
        
        console.log(`   📸 Checkpoint votos: ${totalCheckpointVotes}`);
        
        // Verificar discrepancias
        let hasDiscrepancy = false;
        Object.entries(checkpointVotes).forEach(([candidateId, checkpointCount]) => {
          const correctCount = correctVotes[candidateId]?.votes || 0;
          if (checkpointCount !== correctCount) {
            hasDiscrepancy = true;
          }
        });
        
        if (hasDiscrepancy) {
          console.log(`   ❌ DISCREPANCIA DETECTADA - necesita reparación`);
        } else {
          console.log(`   ✅ Checkpoint correcto`);
        }
      } else {
        console.log(`   ⚠️  Sin checkpoint FREEZE`);
      }
      
      console.log('');
    }

    console.log('🎉 Prueba completada exitosamente!');
    console.log('\n📝 Para ejecutar la reparación real, ejecuta:');
    console.log('   node scripts/fix-corrupted-checkpoints.js');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (require.main === module) {
  testFixScript()
    .then(() => {
      console.log('✅ Script de prueba ejecutado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error ejecutando script de prueba:', error);
      process.exit(1);
    });
}

module.exports = { testFixScript };
