## Componentes de Conteo de Votos (Tap-to-Add)

Componentes: `VoteCard`, `VoteList`, `VoteFooter`.

- `VoteCard`: botón accesible que incrementa en tap/click; `–` resta 1; long-press resta en móviles. Props: `{ id, name, party, partyColor?, number?, count, onIncrement, onDecrement, isPending? }`.
- `VoteList`: renderiza lista de `VoteCard` y conecta con el store con UI optimista. Props: `{ escrutinioId, candidates, userId?, mesaId?, gps?, deviceId? }`.
- `VoteFooter`: muestra total, validación contra papeletas y botón "Continuar". Props: `{ escrutinioId, ballotsUsed?, onContinue }`.

Estado y batching: `src/store/voteStore.ts` usa Zustand + persist. Cada interacción agrega un `delta` al batch y se loguea en `AuditClient`. Se envía a `/api/escrutinio/:id/votes` en bulk cuando hay inactividad de 3s o >20 eventos.

Payload (ejemplo):

```json
{
  "escrutinioId": "JRV-001",
  "votes": [
    { "candidateId": "1", "delta": 1, "timestamp": 1700000000000, "clientBatchId": "uuid" }
  ],
  "gps": { "latitude": -34.6, "longitude": -58.4, "accuracy": 10 },
  "deviceId": "device-...",
  "audit": [{ "event": "vote_increment", "candidateId": "1", "clientBatchId": "uuid", "timestamp": 1700000000000 }]
}
```

Validación: se usa Zod en el store antes de enviar.

Audit: `src/lib/audit-client.ts` guarda eventos en localStorage y los adjunta al batch; en fallo se restauran.

Configurar intervalo de batch: ajustar constantes `IDLE_MS` y `MAX_EVENTS` en `voteStore.ts`.

Testing:
- Unitario `VoteCard.test.tsx`: increment, decrement y accesibilidad por teclado.
- Integración `voteStore.test.ts`: simula batch upload y rollback en fallo.

