# 🗳️ PLAN SISTEMA DE APROBACIÓN Y PRIORIDADES - ELECCIÓN DÍA

## 📋 OBJETIVO PRINCIPAL
Implementar un sistema de aprobación de usuarios y prioridades para el día de las elecciones, donde:
- **Observadores** (entrenados) tienen prioridad alta
- **Voluntarios** tienen prioridad normal
- **Admins** pueden aprobar/rechazar usuarios
- Sistema resistente a cortes de internet

---

## ✅ PARTE 1: ACTUALIZACIÓN DE BASE DE DATOS - COMPLETADA

### 1.1 Actualizar Enums en Prisma Schema ✅
**Archivo:** `prisma/schema.prisma`

```prisma
enum UserRole {
  OBSERVER        // Observadores entrenados (prioridad alta)
  VOLUNTEER       // Voluntarios generales (prioridad baja)  
  ORGANIZATION_MEMBER // Miembros de organizaciones
  ADMIN           // Administradores del sistema
}

enum UserStatus {
  PENDING         // Esperando aprobación
  APPROVED        // Aprobado y activo
  REJECTED        // Rechazado
  SUSPENDED       // Suspendido temporalmente
}
```

### 1.2 Actualizar Modelo User ✅
**Archivo:** `prisma/schema.prisma`

Agregar campos al modelo User:
```prisma
model User {
  // ... campos existentes ...
  
  // NUEVOS CAMPOS
  status          UserStatus  @default(PENDING)
  phone           String?
  organization    String?
  notes           String?     // Notas del admin
  approvedAt      DateTime?
  approvedBy      String?     // ID del admin que aprobó
  rejectedAt      DateTime?
  rejectedBy      String?     // ID del admin que rechazó
  rejectionReason String?
  
  // ... resto del modelo ...
}
```

### 1.3 Actualizar AuditLogAction ✅
**Archivo:** `prisma/schema.prisma`

```prisma
enum AuditLogAction {
  // ... acciones existentes ...
  USER_APPROVED
  USER_REJECTED
  USER_SUSPENDED
}
```

### 1.4 Agregar Sistema de Prioridad a Escrutinio ✅
**Archivo:** `prisma/schema.prisma`

```prisma
model Escrutinio {
  // ... campos existentes ...
  
  // SISTEMA DE PRIORIDAD
  priority        Int         @default(0) // 0 = normal, 1 = alta (observadores)
  queuePosition   Int?        // Posición en cola si hay congestión
  
  // ... resto del modelo ...
}
```

### 1.5 Nuevas Tablas ✅
**Archivo:** `prisma/schema.prisma`

```prisma
// Cola offline para cortes de internet
model OfflineQueue {
  id              String    @id @default(cuid())
  userId          String
  action          String    // 'upload_image', 'submit_votes', etc.
  data            Json      // Datos a procesar
  priority        Int       @default(0)
  retryCount      Int       @default(0)
  maxRetries      Int       @default(3)
  status          String    @default("pending")
  error           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  processedAt     DateTime?
  
  user            User      @relation(fields: [userId], references: [id])
  
  @@map("offline_queue")
}

// Rate limiting por usuario
model UserRateLimit {
  id              String    @id @default(cuid())
  userId          String    @unique
  requests        Int       @default(0)
  windowStart     DateTime  @default(now())
  lastRequest     DateTime  @default(now())
  isBlocked       Boolean   @default(false)
  blockedUntil    DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  user            User      @relation(fields: [userId], references: [id])
  
  @@map("user_rate_limits")
}
```

### 1.6 Crear Migración ✅
```bash
npx prisma migrate dev --name add_user_approval_system
npx prisma generate
```

**✅ MIGRACIÓN APLICADA:** `20250923002139_add_user_approval_system`

---

## ✅ PARTE 2: SISTEMA DE AUTENTICACIÓN - COMPLETADA

### 2.1 Actualizar Login API ✅
**Archivo:** `src/app/api/auth/login/route.ts`

Agregar validaciones de estado:
```typescript
// Verificar estado del usuario
if (user.status === 'PENDING') {
  return NextResponse.json({
    success: false,
    error: 'Tu cuenta está pendiente de aprobación. Un administrador revisará tu solicitud pronto.',
    requiresApproval: true,
  }, { status: 403 });
}

if (user.status === 'REJECTED') {
  return NextResponse.json({
    success: false,
    error: `Tu cuenta ha sido rechazada. ${user.rejectionReason ? `Razón: ${user.rejectionReason}` : ''}`,
    isRejected: true,
  }, { status: 403 });
}

if (user.status === 'SUSPENDED') {
  return NextResponse.json({
    success: false,
    error: 'Tu cuenta ha sido suspendida temporalmente. Contacta al administrador.',
    isSuspended: true,
  }, { status: 403 });
}
```

### 2.2 Actualizar Register API ✅
**Archivo:** `src/app/api/auth/register/route.ts`

Agregar campos adicionales:
```typescript
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  role: z.enum(['OBSERVER', 'VOLUNTEER', 'ORGANIZATION_MEMBER']).default('VOLUNTEER'),
  phone: z.string().optional(),
  organization: z.string().optional(),
});
```

### 2.3 Actualizar Tipos TypeScript ✅
**Archivo:** `src/types/index.ts`

- ✅ Agregados nuevos tipos: `UserStatus`, `OfflineQueue`, `UserRateLimit`
- ✅ Actualizado `RegisterRequest` con nuevos campos
- ✅ Actualizado `ApiResponse` con campos de estado
- ✅ Agregados tipos para sistema de administración

---

## 🎯 PARTE 3: DASHBOARD DE ADMINISTRACIÓN

### 3.1 API para Gestión de Usuarios
**Archivo:** `src/app/api/admin/users/route.ts`

**Funcionalidades:**
- GET: Listar usuarios con filtros (estado, rol, paginación)
- PATCH: Aprobar/rechazar/suspender usuarios
- Validación de permisos de admin
- Logging de auditoría

### 3.2 Dashboard de Administración
**Archivo:** `src/app/admin/page.tsx`

**Funcionalidades:**
- Tabla de usuarios pendientes
- Filtros por estado y rol
- Botones de acción (aprobar/rechazar/suspender)
- Paginación
- Estadísticas de usuarios

### 3.3 Componentes UI
**Archivos:** 
- `src/components/ui/UserStatusBadge.tsx`
- `src/components/ui/UserRoleBadge.tsx`
- `src/components/admin/UserTable.tsx`
- `src/components/admin/UserFilters.tsx`

---

## 🎯 PARTE 4: SISTEMA OFFLINE

### 4.1 Manager de Cola Offline
**Archivo:** `src/lib/offline-queue.ts`

**Funcionalidades:**
- Agregar items a cola local
- Procesar cuando regrese conexión
- Reintentos automáticos
- Prioridades (observadores primero)
- Persistencia en localStorage

### 4.2 Hook para Componentes
**Archivo:** `src/hooks/useOfflineQueue.ts`

```typescript
export function useOfflineQueue() {
  return {
    addToQueue: (action, data, priority) => {},
    isOnline: boolean,
    queueStatus: { pending: number, isProcessing: boolean },
    clearQueue: () => {}
  };
}
```

### 4.3 Integración en Escrutinio
**Archivo:** `src/components/EscrutinioPage.tsx`

- Detectar pérdida de conexión
- Agregar a cola offline automáticamente
- Mostrar estado de sincronización
- Botón de reintento manual

---

## 🎯 PARTE 5: SISTEMA DE PRIORIDADES

### 5.1 Rate Limiting por Rol
**Archivo:** `src/lib/rate-limiter.ts`

```typescript
const RATE_LIMITS = {
  OBSERVER: { requests: 100, window: 60000 }, // 100 req/min
  VOLUNTEER: { requests: 50, window: 60000 },  // 50 req/min
  ORGANIZATION_MEMBER: { requests: 75, window: 60000 }, // 75 req/min
  ADMIN: { requests: 1000, window: 60000 } // Sin límite práctico
};
```

### 5.2 Cola de Prioridad en APIs
**Archivo:** `src/app/api/escrutinio/start/route.ts`

- Asignar prioridad basada en rol de usuario
- Procesar observadores primero
- Cola de espera para voluntarios

### 5.3 Middleware de Prioridad
**Archivo:** `src/middleware/priority.ts`

- Interceptar requests
- Aplicar rate limiting
- Redirigir a cola si es necesario

---

## 🎯 PARTE 6: INTERFAZ DE USUARIO

### 6.1 Página de Registro Mejorada
**Archivo:** `src/app/page.tsx`

- Formulario con campos adicionales (teléfono, organización)
- Selección de rol (Observador/Voluntario/Miembro)
- Mensaje de estado de aprobación

### 6.2 Página de Login Mejorada
**Archivo:** `src/app/page.tsx`

- Manejo de estados de usuario
- Mensajes informativos
- Redirección según estado

### 6.3 Dashboard con Estado de Usuario
**Archivo:** `src/app/dashboard/page.tsx`

- Mostrar estado de aprobación
- Botón de acceso a admin (solo admins)
- Indicador de cola offline

---

## 🎯 PARTE 7: TESTING Y VALIDACIÓN

### 7.1 Tests Unitarios
- `src/app/api/admin/users/route.test.ts`
- `src/lib/offline-queue.test.ts`
- `src/components/admin/UserTable.test.tsx`

### 7.2 Tests de Integración
- Flujo completo de registro → aprobación → login
- Sistema offline → reconexión → sincronización
- Rate limiting por rol

### 7.3 Validación Manual
- [ ] Registro de usuario nuevo
- [ ] Aprobación desde dashboard admin
- [ ] Login con usuario aprobado
- [ ] Rechazo de usuario
- [ ] Sistema offline funciona
- [ ] Prioridades se respetan

---

## 🚀 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. **PARTE 1** - Base de datos (esquema + migración)
2. **PARTE 2** - Autenticación (login/register)
3. **PARTE 3** - Dashboard admin (API + UI)
4. **PARTE 4** - Sistema offline (manager + hook)
5. **PARTE 5** - Prioridades (rate limiting + cola)
6. **PARTE 6** - UI mejorada (registro + login + dashboard)
7. **PARTE 7** - Testing y validación

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Para el Día de Elecciones:
- **Backup automático** de datos críticos
- **Monitoreo** de sistema en tiempo real
- **Plan de contingencia** si falla internet
- **Entrenamiento** de admins en dashboard
- **Documentación** de emergencia

### Seguridad:
- Validación de permisos en todas las APIs
- Logging completo de acciones admin
- Rate limiting para prevenir abuso
- Encriptación de datos sensibles

### Performance:
- Índices en base de datos para consultas rápidas
- Cache de usuarios aprobados
- Optimización de queries admin
- Límites de paginación

---

## 📝 NOTAS DE IMPLEMENTACIÓN

- **Mantener compatibilidad** con sistema actual
- **Migración gradual** sin romper funcionalidad existente
- **Rollback plan** si algo falla
- **Documentación** de cada cambio
- **Testing** en ambiente similar a producción

---

**🎯 OBJETIVO FINAL:** Sistema robusto, escalable y resistente para el día de las elecciones, donde observadores entrenados tienen prioridad y el sistema funciona incluso con cortes de internet.
