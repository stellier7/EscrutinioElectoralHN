# 🧪 Guía de Testing: Correcciones Críticas

## ✅ Estado de Implementación
**Todas las correcciones críticas han sido implementadas** (8/8)
- ✅ Race condition corregido
- ✅ Validación de duplicados implementada
- ✅ Verificación de integridad de checkpoints
- ✅ Logs de auditoría mejorados
- ✅ Validación de límites de votos
- ✅ Backpressure control implementado
- ✅ Pause/resume sync en store legislativo
- ✅ Hashes SHA-256 en checkpoints

---

## 📋 Prioridad de Testing

### 🔴 CRÍTICO - Hacer Primero

#### 1. Test de Race Condition en Congelación
**Objetivo**: Verificar que no se pierden votos al congelar escrutinio

**Pasos**:
1. Abrir consola del navegador (F12)
2. Iniciar sesión y comenzar escrutinio presidencial
3. Hacer click rápido en varios candidatos (agregar 5-10 votos)
4. Inmediatamente hacer click en "Congelar Escrutinio"
5. Verificar en logs de consola que muestra:
   - `⏸️ Auto-sync pausado para evitar race conditions`
   - `📸 Snapshot de votos capturado: {...}`
   - Delay de 100ms antes de captura
6. Verificar que el total de votos en checkpoint coincide con votos en pantalla

**Resultado Esperado**: 
- Todos los votos capturados aparecen en el snapshot
- No hay pérdida de votos

**Cómo verificar logs**:
```javascript
// En consola del navegador
localStorage.getItem('presidential-vote-store-v1')
// Ver pendientesVotes debería estar vacío antes de snapshot
```

---

#### 2. Test de Validación de Duplicados
**Objetivo**: Verificar que votos duplicados son rechazados

**Pasos**:
1. Abrir DevTools → Network tab
2. Iniciar escrutinio presidencial
3. Agregar un voto a candidato "X"
4. Copiar el request de sync desde Network tab
5. Repetir el mismo request manualmente (replay)
6. Verificar en logs del servidor:
   - `⚠️ Batch duplicado detectado: [batchId]`
   - El voto NO se cuenta dos veces

**Verificación en Base de Datos**:
```sql
SELECT * FROM processed_batches WHERE clientBatchId = '[batchId]';
-- Debe existir solo UNA entrada
```

**Resultado Esperado**:
- Segundo request rechazado con warning
- Total de votos NO incrementa en 2, solo en 1

---

#### 3. Test de Verificación de Integridad de Checkpoints
**Objetivo**: Verificar que cambios en checkpoints son detectados

**Pasos**:
1. Crear checkpoint (congelar escrutinio)
2. Obtener `checkpointId` del response
3. En base de datos, modificar `votesSnapshot`:
   ```sql
   UPDATE escrutinio_checkpoints 
   SET "votesSnapshot" = '{"candidateId": 999}'::jsonb 
   WHERE id = 'checkpointId';
   ```
4. Verificar que `snapshotHash` NO coincide con el hash esperado

**Resultado Esperado**:
- Checkpoint corrupto detectado al verificar hash
- Sistema rechaza checkpoint inválido

**Comando para calcular hash esperado**:
```javascript
// En Node.js console
const crypto = require('crypto');
const snapshot = JSON.stringify({candidateId: "1", count: 5});
crypto.createHash('sha256').update(snapshot).digest('hex');
```

---

#### 4. Test de Validación de Límites de Votos
**Objetivo**: Verificar que se alerta cuando se excede carga electoral

**Pasos**:
1. Crear JRV con `cargaElectoral = 100`
2. Iniciar escrutinio para esa JRV
3. Agregar 110 votos (10% sobre carga)
4. Verificar en logs:
   - `⚠️ Vote overflow detected: 110 > 100`
   - Se crea entrada en `audit_logs` con acción `CORRECTION`

**Resultado Esperado**:
- Anomalía detectada y logueada
- Admin puede ver alerta en dashboard
- Sistema permite el voto pero registra anomalía

---

#### 5. Test de Backpressure Control
**Objetivo**: Verificar que no hay syncs concurrentes

**Pasos**:
1. Abrir consola del navegador
2. Iniciar escrutinio
3. Agregar múltiples votos rápidamente (10+ clicks rápidos)
4. Verificar en consola que NO aparece múltiples veces:
   - `📤 [SYNC] Sync iniciado...`
5. Verificar que aparece solo UNA vez por intervalo de 3 segundos
6. Si sync anterior aún no termina, debería mostrar:
   - `⏸️ Sync anterior aún en progreso, saltando este ciclo...`

**Resultado Esperado**:
- Solo un sync activo a la vez
- No hay race conditions en sincronización

---

### 🟡 IMPORTANTE - Hacer Después

#### 6. Test de Flujo Completo Presidencial (Online)
**Pasos**:
1. Login → Seleccionar JRV → Seleccionar "Presidencial"
2. Obtener GPS
3. Agregar votos (10-15 distribuyendo entre candidatos)
4. Verificar auto-save funciona (ver en Network cada 3 seg)
5. Congelar escrutinio
6. Subir acta (imagen)
7. Enviar resultados
8. Verificar en base de datos:
   - `escrutinios.isCompleted = true`
   - Votes correctos en tabla `votes`
   - Checkpoint creado con hash válido
   - Audit logs contienen eventos correctos

**Resultado Esperado**: Todo funciona sin errores

---

#### 7. Test de Flujo Completo Legislativo (Online)
**Pasos similares al presidencial pero**:
- Apertar partido para ver casillas
- Seleccionar casillas (papeleta)
- Verificar que maxVotes por papeleta se respeta
- Verificar que sync funciona con estructura de partidos

**Resultado Esperado**: Funciona igual que presidencial

---

#### 8. Test de Pérdida de Conexión Durante Votación
**Pasos**:
1. Iniciar escrutinio
2. Agregar algunos votos
3. Desconectar internet (desactivar WiFi)
4. Agregar más votos (deberían quedar en `pendingVotes`)
5. Reconectar internet
6. Verificar que votos offline se sincronizan automáticamente

**Resultado Esperado**:
- Votos offline se guardan localmente
- Se sincronizan al reconectar
- Total final es correcto

---

### 🟢 OPCIONAL - Si Hay Tiempo

#### 9. Test de Múltiples Dispositivos Simultáneos
**Pasos**:
1. Abrir app en 2 dispositivos/navegadores
2. Mismo usuario, misma JRV
3. Agregar votos desde ambos dispositivos
4. Verificar que no hay conflictos
5. Uno congela, el otro debería ver el cambio

**Resultado Esperado**:
- No hay conflictos
- Sincronización eventual funciona

---

#### 10. Test de Logs de Auditoría
**Objetivo**: Verificar que todos los eventos se loguean

**Pasos**:
1. Realizar acciones: login, votar, congelar, enviar
2. Verificar en `audit_logs`:
```sql
SELECT action, description, timestamp 
FROM audit_logs 
WHERE "userId" = 'tu-user-id'
ORDER BY timestamp;
```

**Resultado Esperado**:
- Ver: START_ESCRUTINIO, CLOSE_ESCRUTINIO, SUBMIT_RESULTS
- Logs con metadata correcta (escrutinioId, totalVotes, etc)

---

## 🛠️ Herramientas de Testing

### 1. Consola del Navegador
```javascript
// Ver estado del store
localStorage.getItem('presidential-vote-store-v1')

// Ver estado del store legislativo
localStorage.getItem('legislative-vote-store-v1')

// Verificar offline queue
localStorage.getItem('offline-queue')
```

### 2. SQL Queries Útiles
```sql
-- Ver últimos escrutinios
SELECT id, "userId", "mesaId", "electionLevel", status, "createdAt"
FROM escrutinios
ORDER BY "createdAt" DESC
LIMIT 10;

-- Ver votos de un escrutinio
SELECT c.name, c.party, v.count
FROM votes v
JOIN candidates c ON c.id = v."candidateId"
WHERE v."escrutinioId" = 'escrutinio-id';

-- Ver checkpoints
SELECT id, action, "snapshotHash", timestamp
FROM escrutinio_checkpoints
WHERE "escrutinioId" = 'escrutinio-id'
ORDER BY timestamp;

-- Ver batches procesados
SELECT "clientBatchId", "escrutinioId", "processedAt"
FROM processed_batches
WHERE "escrutinioId" = 'escrutinio-id';

-- Ver anomalías
SELECT id, action, description, metadata
FROM audit_logs
WHERE action = 'CORRECTION'
ORDER BY timestamp DESC
LIMIT 10;
```

### 3. Network Tab Monitoring
- Filtrar por `/api/escrutinio/`
- Verificar:
  - POST a `/votes` ocurre cada 3 segundos
  - POST a `/checkpoint` cuando congelas
  - Estado 200 para todos los requests

---

## 📊 Checklist de Testing

### Tests Críticos
- [ ] Race condition en congelación corregido
- [ ] Duplicados rechazados
- [ ] Integridad de checkpoints verificada
- [ ] Límites de votos alertan
- [ ] Backpressure control funciona

### Tests de Integración
- [ ] Flujo presidencial completo
- [ ] Flujo legislativo completo
- [ ] Pérdida de conexión funciona
- [ ] Múltiples dispositivos sin conflictos

### Tests de Auditoría
- [ ] Logs generados correctamente
- [ ] Metadata completa en logs
- [ ] Timestamps correctos

---

## 🚨 Bugs Críticos a Buscar

1. **Pérdida de votos**: Votos que se agregan no aparecen en checkpoint
2. **Duplicación**: Mismo voto contado dos veces
3. **Sync concurrente**: Múltiples syncs simultáneos causan inconsistencias
4. **Checkpoint corrupto**: Hash no coincide con snapshot
5. **Anomalías no detectadas**: Overflow de votos no alerta

---

## 📝 Reporte de Testing

Después de cada test, documentar:

```markdown
## Test: [Nombre]
**Fecha**: [Fecha]
**Resultado**: ✅ PASS / ❌ FAIL
**Observaciones**: 
- [Notas importantes]
- [Bugs encontrados]
- [Screenshots/logs]
```

---

## 🎯 Criterio de Éxito

El sistema pasa a producción si:
- ✅ Todos los tests críticos pasan
- ✅ Al menos 80% de tests de integración pasan
- ✅ No hay bugs críticos (pérdida de datos, duplicación)
- ✅ Performance aceptable (<2s para operaciones)

**¡Éxito en el testing!** 🚀
