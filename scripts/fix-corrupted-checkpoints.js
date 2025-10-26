#!/usr/bin/env node

/**
 * Script para reparar escrutinios presidenciales con checkpoints corruptos
 * 
 * Este script:
 * 1. Identifica escrutinios presidenciales con checkpoints que tienen votos inconsistentes
 * 2. Recalcula los votos correctos desde la tabla `votes` (fuente de verdad)
 * 3. Actualiza el `votesSnapshot` en los checkpoints con los datos correctos
 * 4. Genera un reporte de escrutinios reparados
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCorruptedCheckpoints() {
  console.log('🔧 Iniciando reparación de checkpoints corruptos...\n');

  try {
    // 1. Obtener todos los escrutinios presidenciales con checkpoints
    const escrutinios = await prisma.escrutinio.findMany({
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
          take: 1 // Solo el último checkpoint FREEZE
        },
        mesa: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`📊 Encontrados ${escrutinios.length} escrutinios presidenciales cerrados\n`);

    const repairedEscrutinios = [];
    const skippedEscrutinios = [];

    for (const escrutinio of escrutinios) {
      console.log(`🔍 Analizando escrutinio ${escrutinio.id} (JRV ${escrutinio.mesa.number})...`);

      // 2. Calcular votos correctos desde la tabla votes
      const correctVotes = {};
      let totalCorrectVotes = 0;

      escrutinio.votes.forEach(vote => {
        const candidateId = vote.candidateId;
        if (!correctVotes[candidateId]) {
          correctVotes[candidateId] = {
            id: candidateId,
            name: vote.candidate.name,
            party: vote.candidate.party,
            number: vote.candidate.number,
            votes: 0
          };
        }
        correctVotes[candidateId].votes += vote.count;
        totalCorrectVotes += vote.count;
      });

      console.log(`   📈 Votos correctos calculados: ${totalCorrectVotes} votos totales`);
      console.log(`   📋 Candidatos con votos: ${Object.keys(correctVotes).length}`);

      // 3. Verificar si hay checkpoint para comparar
      if (escrutinio.checkpoints.length === 0) {
        console.log(`   ⚠️  No hay checkpoint FREEZE - saltando`);
        skippedEscrutinios.push({
          id: escrutinio.id,
          mesaNumber: escrutinio.mesa.number,
          reason: 'No checkpoint FREEZE'
        });
        continue;
      }

      const checkpoint = escrutinio.checkpoints[0];
      const checkpointVotes = checkpoint.votesSnapshot || {};

      // 4. Comparar votos del checkpoint con votos correctos
      let hasDiscrepancy = false;
      const discrepancies = [];

      // Verificar candidatos en el checkpoint
      Object.entries(checkpointVotes).forEach(([candidateId, checkpointCount]) => {
        const correctCount = correctVotes[candidateId]?.votes || 0;
        if (checkpointCount !== correctCount) {
          hasDiscrepancy = true;
          discrepancies.push({
            candidateId,
            candidateName: correctVotes[candidateId]?.name || 'Unknown',
            checkpointCount,
            correctCount,
            difference: correctCount - checkpointCount
          });
        }
      });

      // Verificar candidatos que faltan en el checkpoint
      Object.entries(correctVotes).forEach(([candidateId, candidateData]) => {
        if (!(candidateId in checkpointVotes) && candidateData.votes > 0) {
          hasDiscrepancy = true;
          discrepancies.push({
            candidateId,
            candidateName: candidateData.name,
            checkpointCount: 0,
            correctCount: candidateData.votes,
            difference: candidateData.votes
          });
        }
      });

      if (!hasDiscrepancy) {
        console.log(`   ✅ Checkpoint correcto - no necesita reparación`);
        skippedEscrutinios.push({
          id: escrutinio.id,
          mesaNumber: escrutinio.mesa.number,
          reason: 'Checkpoint correcto'
        });
        continue;
      }

      // 5. Mostrar discrepancias encontradas
      console.log(`   ❌ Discrepancias encontradas:`);
      discrepancies.forEach(d => {
        console.log(`      ${d.candidateName}: checkpoint=${d.checkpointCount}, correcto=${d.correctCount} (diff: ${d.difference > 0 ? '+' : ''}${d.difference})`);
      });

      // 6. Reparar el checkpoint
      try {
        await prisma.escrutinioCheckpoint.update({
          where: { id: checkpoint.id },
          data: {
            votesSnapshot: correctVotes
          }
        });

        console.log(`   🔧 Checkpoint reparado exitosamente`);

        repairedEscrutinios.push({
          id: escrutinio.id,
          mesaNumber: escrutinio.mesa.number,
          user: escrutinio.user,
          discrepancies: discrepancies.length,
          totalVotes: totalCorrectVotes,
          checkpointId: checkpoint.id
        });

      } catch (error) {
        console.log(`   ❌ Error reparando checkpoint: ${error.message}`);
        skippedEscrutinios.push({
          id: escrutinio.id,
          mesaNumber: escrutinio.mesa.number,
          reason: `Error: ${error.message}`
        });
      }

      console.log(''); // Línea en blanco para separar
    }

    // 7. Generar reporte final
    console.log('📊 REPORTE FINAL');
    console.log('================');
    console.log(`✅ Escrutinios reparados: ${repairedEscrutinios.length}`);
    console.log(`⏭️  Escrutinios saltados: ${skippedEscrutinios.length}`);
    console.log(`📈 Total procesados: ${escrutinios.length}\n`);

    if (repairedEscrutinios.length > 0) {
      console.log('🔧 ESCRUTINIOS REPARADOS:');
      console.log('========================');
      repairedEscrutinios.forEach(escrutinio => {
        console.log(`• JRV ${escrutinio.mesaNumber} (${escrutinio.user.name})`);
        console.log(`  ID: ${escrutinio.id}`);
        console.log(`  Discrepancias corregidas: ${escrutinio.discrepancias}`);
        console.log(`  Total votos: ${escrutinio.totalVotes}`);
        console.log(`  Checkpoint ID: ${escrutinio.checkpointId}`);
        console.log('');
      });
    }

    if (skippedEscrutinios.length > 0) {
      console.log('⏭️  ESCRUTINIOS SALTADOS:');
      console.log('=======================');
      skippedEscrutinios.forEach(escrutinio => {
        console.log(`• JRV ${escrutinio.mesaNumber}: ${escrutinio.reason}`);
      });
    }

    console.log('\n🎉 Reparación completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la reparación:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (require.main === module) {
  fixCorruptedCheckpoints()
    .then(() => {
      console.log('✅ Script ejecutado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { fixCorruptedCheckpoints };
