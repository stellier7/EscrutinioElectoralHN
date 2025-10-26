
## Testing

- [x] Agregar votos, hacer click en "Obtener ubicación", verificar que votos NO se borran
- [x] Hacer refresh, verificar que location persiste y no pide ubicación de nuevo
- [x] Verificar que el GPS se actualiza correctamente
- [x] Verificar que NO se crea un nuevo escrutinio al actualizar GPS

## Implementación Completada

### Cambios Realizados

1. **useEscrutinioPersistence.ts**: Agregado `location` a los datos que se guardan en localStorage
2. **page.tsx**: 
   - Eliminada línea que limpia votos en `handleGetLocation`
   - Agregada lógica para solo actualizar GPS si ya hay escrutinio activo
   - Eliminado `useEffect` que limpiaba votos innecesariamente
3. **PresidencialEscrutinio.tsx**: Modificado para NO limpiar votos automáticamente

### Resultado
- Los votos ya NO se borran cuando haces click en "Obtener ubicación"
- El GPS persiste después de refresh
- No se crea un nuevo escrutinio al actualizar GPS

### To-dos


