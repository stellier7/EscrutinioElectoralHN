#!/usr/bin/env node

/**
 * Script para limpiar escrutinios de prueba
 * Elimina escrutinios que no han sido finalizados y son de hace más de 1 hora
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupTestScrutinios() {
  try {
    console.log('🧹 Iniciando limpieza de escrutinios de prueba...');
    
    // Buscar escrutinios que:
    // 1. No han sido finalizados (completedAt es null)
    // 2. Fueron creados hace más de 1 hora
    // 3. Están en estado COMPLETED (en progreso)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const testScrutinios = await prisma.escrutinio.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: null,
        createdAt: {
          lt: oneHourAgo
        }
      },
      include: {
        mesa: true
      }
    });
    
    console.log(`🔍 Encontrados ${testScrutinios.length} escrutinios de prueba para eliminar`);
    
    if (testScrutinios.length === 0) {
      console.log('✅ No hay escrutinios de prueba para limpiar');
      return;
    }
    
    // Mostrar lista de escrutinios que se van a eliminar
    console.log('\n📋 Escrutinios que se eliminarán:');
    testScrutinios.forEach((escrutinio, index) => {
      console.log(`${index + 1}. ID: ${escrutinio.id}`);
      console.log(`   JRV: ${escrutinio.mesa?.number || 'N/A'}`);
      console.log(`   Nivel: ${escrutinio.electionLevel}`);
      console.log(`   Creado: ${escrutinio.createdAt.toLocaleString()}`);
      console.log('');
    });
    
    // Eliminar cada escrutinio
    for (const escrutinio of testScrutinios) {
      console.log(`🗑️ Eliminando escrutinio ${escrutinio.id}...`);
      
      await prisma.$transaction(async (tx) => {
        // Eliminar votos
        await tx.vote.deleteMany({ 
          where: { escrutinioId: escrutinio.id } 
        });
        
        // Eliminar papeletas
        await tx.papeleta.deleteMany({ 
          where: { escrutinioId: escrutinio.id } 
        });
        
        // Eliminar logs de auditoría relacionados
        await tx.auditLog.deleteMany({ 
          where: { 
            metadata: {
              path: ['escrutinioId'],
              equals: escrutinio.id
            }
          } 
        });
        
        // Eliminar el escrutinio
        await tx.escrutinio.delete({ 
          where: { id: escrutinio.id } 
        });
      });
      
      console.log(`✅ Escrutinio ${escrutinio.id} eliminado`);
    }
    
    console.log(`\n🎉 Limpieza completada. ${testScrutinios.length} escrutinios eliminados.`);
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
cleanupTestScrutinios();
