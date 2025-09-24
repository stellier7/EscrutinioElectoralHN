// Script para debuggear el payload
const { z } = require('zod');

const VoteDeltaSchema = z.object({
  candidateId: z.string().min(1),
  delta: z.number().int().min(-1000).max(1000),
  timestamp: z.number(),
  clientBatchId: z.string().min(1),
});

const VotePayloadSchema = z.object({
  escrutinioId: z.string().min(1),
  votes: z.array(VoteDeltaSchema).min(1),
  gps: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
    })
    .optional(),
  deviceId: z.string().optional(),
  audit: z.any().array().optional(),
});

// Simular payload típico
const testPayload = {
  escrutinioId: "test-id-123",
  votes: [
    {
      candidateId: "candidate-1",
      delta: 1,
      timestamp: Date.now(),
      clientBatchId: "batch-123"
    }
  ],
  gps: {
    latitude: 14.6349,
    longitude: -87.8251,
    accuracy: 10
  },
  deviceId: "device-123",
  audit: []
};

console.log('🧪 Probando payload:', JSON.stringify(testPayload, null, 2));

const result = VotePayloadSchema.safeParse(testPayload);
if (!result.success) {
  console.error('❌ Error de validación:', JSON.stringify(result.error, null, 2));
} else {
  console.log('✅ Payload válido');
}
