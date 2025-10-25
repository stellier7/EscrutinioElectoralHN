# 🚨 GUÍA DE RECUPERACIÓN DE EMERGENCIA

## Si TODO se borra de la base de datos

### ⚡ RECUPERACIÓN RÁPIDA (5 minutos)

Ejecuta estos comandos en orden:

```bash
# 1. Restaurar JRVs desde CSV
node scripts/restore-jrvs-from-csv.js

# 2. Crear sesión activa
node scripts/create-active-session.js

# 3. Aprobar todos los usuarios
node scripts/approve-all-users.js
```

---

## 📋 RECUPERACIÓN COMPLETA (desde backup)

### Opción A: Restaurar desde Backup JSON (recomendado)

```bash
# 1. Ver backups disponibles
node scripts/restore-from-backup.js

# 2. Restaurar el backup más reciente
node scripts/restore-from-backup.js backups/backup-2025-01-10T15-30-00.json
```

### Opción B: Restaurar desde Backup SQL (más rápido)

```bash
node scripts/restore-from-backup.js backups/backup-2025-01-10T15-30-00.sql
```

---

## 🔍 VERIFICAR ESTADO DE LA BASE DE DATOS

```bash
node scripts/verify-database-status.js
```

Esto te mostrará:
- ✅ Cuántos usuarios hay
- ✅ Cuántas mesas/JRVs hay
- ✅ Cuántas sesiones hay
- ✅ Cuántos escrutinios hay

---

## 📁 UBICACIÓN DE ARCHIVOS CRÍTICOS

### Backups Automáticos
```
backups/
  ├── backup-2025-01-10T15-30-00.json  (legible, portable)
  └── backup-2025-01-10T15-30-00.sql   (rápido de restaurar)
```

### Datos Originales
```
jrvs-2025-revision.csv  (19,159 JRVs originales)
```

---

## 🛡️ PREVENCIÓN

### Crear Backup Manual

```bash
# Crear backup antes de cualquier operación riesgosa
node scripts/backup-database.js
```

### Backups Automáticos

Los backups se crean automáticamente:
- ✅ Antes de ejecutar scripts de seed
- ✅ Cada 24 horas (si está configurado)
- ✅ Antes de operaciones destructivas

---

## 🚫 SCRIPTS PELIGROSOS (NO EJECUTAR)

**NUNCA ejecutes estos scripts sin backup:**

```bash
# ❌ PELIGRO: Borra todos los JRVs y escrutinios
node scripts/seed-jrvs-and-departments.js

# ❌ PELIGRO: Resetea toda la base de datos
npx prisma migrate reset

# ❌ PELIGRO: Borra datos de prueba (puede borrar más)
node scripts/cleanup-test-scrutinios.js
```

---

## 📞 CONTACTO DE EMERGENCIA

Si nada funciona:

1. **Verificar que el servidor de base de datos esté corriendo**
   ```bash
   # PostgreSQL
   brew services list | grep postgresql
   ```

2. **Verificar conexión a base de datos**
   ```bash
   npx prisma db pull
   ```

3. **Regenerar cliente de Prisma**
   ```bash
   npx prisma generate
   ```

---

## ✅ CHECKLIST POST-RECUPERACIÓN

Después de restaurar, verifica:

- [ ] Usuarios pueden hacer login (`admin@escrutinio.com` / `admin123`)
- [ ] Hay JRVs disponibles en el selector
- [ ] Hay una sesión activa
- [ ] Se pueden crear escrutinios
- [ ] Los votos se guardan correctamente
- [ ] Las ubicaciones GPS funcionan

---

## 🔐 CREDENCIALES POR DEFECTO

```
Admin:
  Email: admin@escrutinio.com
  Password: admin123

Auditor:
  Email: auditor@escrutinio.com
  Password: auditor123
```

---

## 📊 ESTADÍSTICAS NORMALES

Una base de datos saludable debe tener:

- **Usuarios:** 2+ (admin, auditor, + voluntarios)
- **JRVs/Mesas:** 19,159 (Honduras 2025)
- **Sesiones:** 1+ (al menos una activa)
- **Departamentos:** 18 (departamentos de Honduras)
- **Candidatos:** 5+ (presidenciales) + legislativos
- **Escrutinios:** Variable (según uso)

---

## 🆘 ÚLTIMO RECURSO

Si todo falla, puedes reconstruir desde cero:

```bash
# 1. Resetear base de datos (CUIDADO)
npx prisma migrate reset --force

# 2. Restaurar JRVs
node scripts/restore-jrvs-from-csv.js

# 3. Crear sesión
node scripts/create-active-session.js

# 4. Aprobar usuarios
node scripts/approve-all-users.js
```

**⚠️ ESTO BORRARÁ TODO. Solo usar si no hay otra opción.**

