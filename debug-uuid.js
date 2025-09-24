// Script para debuggear la generación de UUID
const { v4: uuidv4 } = require('uuid');

console.log('🧪 Probando generación de UUIDs:');

for (let i = 0; i < 5; i++) {
  const uuid = uuidv4();
  console.log(`UUID ${i + 1}:`, uuid);
  console.log(`  - Longitud:`, uuid.length);
  console.log(`  - Es string:`, typeof uuid === 'string');
  console.log(`  - No está vacío:`, uuid.length > 0);
  console.log('---');
}

// Verificar si el problema podría estar en el tipo de datos
const testData = {
  clientBatchId: uuidv4(),
  candidateId: "test-candidate",
  delta: 1,
  timestamp: Date.now()
};

console.log('🧪 Datos de prueba completos:', JSON.stringify(testData, null, 2));

// Verificar tipos específicos
console.log('🔍 Verificación de tipos:');
console.log('  - clientBatchId type:', typeof testData.clientBatchId);
console.log('  - candidateId type:', typeof testData.candidateId);
console.log('  - delta type:', typeof testData.delta);
console.log('  - timestamp type:', typeof testData.timestamp);
