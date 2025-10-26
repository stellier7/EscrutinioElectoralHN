# Scripts de Reparación de Escrutinios

Este directorio contiene scripts para reparar escrutinios presidenciales que tienen checkpoints corruptos debido al bug de sincronización de votos durante la captura de GPS.

## Problema

Cuando se cierra un escrutinio presidencial, había una **race condition** entre:
1. La captura del snapshot de votos para el checkpoint
2. La captura asíncrona del GPS final
3. El auto-save continuo del voteStore

Esto causaba que los votos se "glitchearan" y aparecieran valores inconsistentes entre:
- Las tarjetas de votos individuales
- El resumen de votos (donde algunos candidatos desaparecían)
- El timeline de auditoría (que mostraba el snapshot intermedio)

## Scripts Disponibles

### 1. `test-fix-script.js` - Script de Prueba

**Propósito:** Analizar escrutinios existentes sin modificar datos.

**Uso:**
```bash
node scripts/test-fix-script.js
```

**Qué hace:**
- Verifica la conexión a la base de datos
- Cuenta escrutinios presidenciales y checkpoints
- Analiza algunos escrutinios de ejemplo
- Detecta discrepancias entre votos reales y checkpoints
- **NO modifica datos** - solo hace análisis

### 2. `fix-corrupted-checkpoints.js` - Script de Reparación

**Propósito:** Reparar escrutinios con checkpoints corruptos.

**Uso:**
```bash
node scripts/fix-corrupted-checkpoints.js
```

**Qué hace:**
1. Identifica escrutinios presidenciales con checkpoints corruptos
2. Recalcula los votos correctos desde la tabla `votes` (fuente de verdad)
3. Actualiza el `votesSnapshot` en los checkpoints con los datos correctos
4. Genera un reporte detallado de escrutinios reparados
5. Mantiene el historial de auditoría y timestamps originales

## Flujo Recomendado

1. **Primero ejecuta el script de prueba:**
   ```bash
   node scripts/test-fix-script.js
   ```
   Esto te mostrará cuántos escrutinios necesitan reparación.

2. **Si hay escrutinios que necesitan reparación, ejecuta el script de reparación:**
   ```bash
   node scripts/fix-corrupted-checkpoints.js
   ```

3. **Verifica los resultados** revisando los escrutinios en la interfaz web.

## Seguridad

- Los scripts **NO eliminan datos**
- Solo actualizan el campo `votesSnapshot` en los checkpoints
- Mantienen todos los timestamps y metadatos originales
- Los votos reales en la tabla `votes` no se modifican (son la fuente de verdad)

## Logs

Los scripts generan logs detallados que incluyen:
- Número de escrutinios procesados
- Discrepancias encontradas y corregidas
- IDs de checkpoints modificados
- Errores si los hay

## Requisitos

- Node.js instalado
- Base de datos Prisma configurada
- Variables de entorno de base de datos configuradas

## Notas Técnicas

- El script usa la tabla `votes` como fuente de verdad para los votos correctos
- Compara los votos del checkpoint con los votos reales de la base de datos
- Solo repara checkpoints que tienen discrepancias
- Mantiene la integridad referencial de la base de datos
