# 📧 Sistema de Campañas y Broadcast - Guía Completa

## 📋 Tabla de Contenidos

1. [Resumen del Sistema](#resumen-del-sistema)
2. [Configuración Inicial](#configuración-inicial)
3. [Cómo Funciona](#cómo-funciona)
4. [Variables de Entorno](#variables-de-entorno)
5. [Crear Cuentas](#crear-cuentas)
6. [Guía de Uso](#guía-de-uso)
7. [API Endpoints](#api-endpoints)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Resumen del Sistema

Este sistema permite:

1. **Notificaciones Automáticas**: Cuando alguien se registra como voluntario, recibe automáticamente un email Y un WhatsApp de bienvenida
2. **Broadcast Masivo**: Enviar emails y WhatsApp masivos a todos los voluntarios desde el panel admin
3. **Confirmación de Asistencia**: Crear eventos (como live en YouTube) y que los voluntarios confirmen su asistencia con links únicos
4. **Segmentación**: Filtrar destinatarios por rol (Observadores/Voluntarios) o por JRV específica

---

## ⚙️ Configuración Inicial

### Paso 1: Aplicar Migración de Base de Datos

```bash
# En desarrollo
npx prisma migrate dev

# En producción (Vercel)
npx prisma migrate deploy

# Generar cliente Prisma
npx prisma generate
```

### Paso 2: Crear Cuentas (ver sección [Crear Cuentas](#crear-cuentas))

1. Crear cuenta en Resend (para emails)
2. Crear cuenta en ChatAPI (para WhatsApp)

### Paso 3: Configurar Variables de Entorno

Ver sección [Variables de Entorno](#variables-de-entorno) más abajo.

---

## 🔄 Cómo Funciona

### 1. Notificaciones Automáticas al Registrarse

**Flujo:**
```
Usuario llena formulario → Se guarda en BD → Se envían email + WhatsApp automáticamente
```

**Ubicación del código:**
- `src/app/api/volunteers/apply/route.ts` - Endpoint de registro
- `src/lib/email-service.ts` - Servicio de emails
- `src/lib/whatsapp-service.ts` - Servicio de WhatsApp

**Características:**
- Se envían en paralelo (no bloquea la respuesta)
- Si falla uno, el otro se envía igual
- Templates predefinidos con información personalizada

### 2. Sistema de Campañas (Broadcast)

**Flujo:**
```
Admin crea campaña → Selecciona destinatarios → Escribe contenido → Envía → Se registra cada envío
```

**Ubicación:**
- Panel: `/admin/campaigns`
- API: `/api/admin/campaigns`
- Envío: `/api/admin/campaigns/[id]/send`

**Características:**
- Crear campañas con email y/o WhatsApp
- Filtrar por rol (Observadores/Voluntarios) o JRV
- Ver estadísticas de envío en tiempo real
- Templates con variables dinámicas

### 3. Confirmación de Asistencia a Eventos

**Flujo:**
```
Admin crea evento → Sistema genera links únicos → Envía invitaciones → Voluntarios confirman → Dashboard de confirmados
```

**Ubicación:**
- Crear evento: `/api/admin/campaigns/events`
- Página de confirmación: `/confirmar/[token]`
- API confirmación: `/api/confirm/[token]`

**Características:**
- Links únicos por voluntario
- Tres estados: Confirmado / Tal vez / No asistiré
- Tracking de quién confirmó
- Comentarios opcionales

---

## 🔐 Variables de Entorno

Agrega estas variables en tu archivo `.env` local y en el panel de Vercel:

### Variables Requeridas para Email (Resend)

```env
# API Key de Resend (obtener en: https://resend.com/api-keys)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email desde el que se enviarán los mensajes (debe estar verificado en Resend)
RESEND_FROM_EMAIL=noreply@escrutinio.com

# Nombre que aparecerá como remitente
RESEND_FROM_NAME=Escrutinio Transparente
```

### Variables Requeridas para WhatsApp (ChatAPI)

```env
# API Key de ChatAPI (obtener en: https://app.chat-api.com/)
CHATAPI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Instance ID de ChatAPI (obtener al crear instancia)
CHATAPI_INSTANCE_ID=123456789

# Número de teléfono conectado a ChatAPI (formato: +504XXXXXXXX)
CHATAPI_PHONE_NUMBER=+504XXXXXXXX
```

### Variables Opcionales

```env
# URL base de tu aplicación (para links de confirmación)
# En desarrollo: http://localhost:3000
# En producción: https://tu-dominio.vercel.app
APP_BASE_URL=https://tu-dominio.vercel.app
```

### 📝 Resumen Rápido - Variables a Agregar

```env
# EMAIL
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=Escrutinio Transparente

# WHATSAPP
CHATAPI_API_KEY=
CHATAPI_INSTANCE_ID=
CHATAPI_PHONE_NUMBER=

# OPCIONAL
APP_BASE_URL=https://escrutinio-electoral-hn-4diq.vercel.app
```

---

## 🌐 Crear Cuentas

### 1. Resend (Para Emails)

**URL:** https://resend.com/

**Pasos:**

1. **Crear cuenta:**
   - Ve a https://resend.com/
   - Clic en "Get Started" o "Sign Up"
   - Completa el registro (solo requiere email, NO número de teléfono)
   - Verifica tu email

2. **Verificar email:**
   - Resend solo requiere verificar tu email (no dominio ni número de teléfono)
   - Revisa tu correo y haz clic en el link de verificación
   - **IMPORTANTE:** Usa este email verificado en `RESEND_FROM_EMAIL`

3. **Crear API Key:**
   - Ve a https://resend.com/api-keys
   - Clic en "Create API Key"
   - Nombre: "Escrutinio Transparente"
   - Permisos: "Sending access" (suficiente)
   - Copia el API Key inmediatamente (solo se muestra una vez)
   - **Pega este valor en `RESEND_API_KEY`**

4. **Plan Gratuito:**
   - 100 emails gratis por día
   - Suficiente para empezar
   - Puedes escalar después si necesitas más

**Ventajas:**
- ✅ Solo requiere verificar email (NO número de teléfono)
- ✅ No requiere dominio propio
- ✅ API simple y moderna
- ✅ Buena documentación

**Documentación:** https://resend.com/docs

---

### 2. ChatAPI (Para WhatsApp)

**URL:** https://chat-api.com/

**Pasos:**

1. **Crear cuenta:**
   - Ve a https://chat-api.com/
   - Clic en "Sign Up" o "Get Started"
   - Completa el registro (solo requiere email, NO verificación de número de teléfono para la cuenta)
   - Verifica tu email

2. **Crear Instancia:**
   - Después de registrarte, ve a tu dashboard
   - Clic en "Create Instance" o "Add Instance"
   - Selecciona "WhatsApp"
   - Te dará un QR code para escanear

3. **Conectar WhatsApp:**
   - Abre WhatsApp en tu teléfono
   - Ve a Configuración → Dispositivos vinculados → Vincular un dispositivo
   - Escanea el QR code que muestra ChatAPI
   - Una vez conectado, obtendrás:
     - **API Key** → Copia a `CHATAPI_API_KEY`
     - **Instance ID** → Copia a `CHATAPI_INSTANCE_ID`
     - **Phone Number** → Copia a `CHATAPI_PHONE_NUMBER`

4. **Plan Gratuito:**
   - Limitado pero suficiente para empezar
   - Puedes escalar después si necesitas más

**Ventajas:**
- ✅ No requiere verificación de número de teléfono para crear la cuenta
- ✅ Solo necesitas conectar tu WhatsApp (escaneando QR)
- ✅ API simple con HTTP requests
- ✅ Funciona con WhatsApp personal o Business

**Nota Importante:** 
- ChatAPI requiere conectar un WhatsApp real (escaneando QR code)
- Pero NO requiere verificar número de teléfono para crear la cuenta del servicio
- Puedes usar tu WhatsApp personal para empezar

**Documentación:** https://chat-api.com/docs

---

## 📖 Guía de Uso

### Escenario 1: Notificaciones Automáticas

**No requiere acción.** Funciona automáticamente cuando alguien se registra.

**Lo que pasa:**
1. Usuario llena el formulario en `/voluntarios`
2. Sistema guarda la solicitud
3. Se envían automáticamente:
   - Email de bienvenida personalizado
   - WhatsApp de bienvenida personalizado

**Verificación:**
- Revisa los logs de Resend y ChatAPI para confirmar envío
- Los errores se registran en consola (no bloquean el registro)

---

### Escenario 2: Enviar Broadcast Masivo (Anuncio General)

**Ejemplo:** Anunciar una nueva reunión a todos los voluntarios

1. **Ir al panel:**
   ```
   /admin/campaigns
   ```

2. **Crear nueva campaña:**
   - Clic en "Nueva Campaña"
   - Llenar formulario:
     - **Nombre:** "Anuncio Reunión Enero 2025"
     - **Descripción:** "Invitación a reunión informativa"
     - **Tipo de Evento:** "meeting" (opcional)
     - **Fecha del Evento:** (opcional)
     - **Filtrar por Rol:** Dejar en "Todos" o seleccionar
     - **Filtrar por JRV:** (opcional, dejar vacío)

3. **Contenido de Email:**
   ```
   Asunto: Invitación a Reunión Informativa - Enero 2025
   
   Contenido HTML:
   <h2>Hola {firstName},</h2>
   <p>Te invitamos a nuestra reunión informativa...</p>
   <p>Fecha: 15 de Enero, 2025</p>
   <p>Hora: 7:00 PM</p>
   <p>¡Esperamos verte!</p>
   ```

4. **Contenido de WhatsApp:**
   ```
   Hola {firstName}! 👋
   
   Te invitamos a nuestra reunión informativa:
   📅 15 de Enero, 2025
   🕐 7:00 PM
   
   ¡Esperamos verte!
   ```

5. **Crear y enviar:**
   - Clic en "Crear Campaña"
   - Aparecerá en la lista
   - Clic en "Enviar"
   - Confirmar el envío
   - Ver estadísticas en tiempo real

---

### Escenario 3: Live en YouTube con Confirmación

**Ejemplo:** Crear evento para live de YouTube y que confirmen asistencia

1. **Opción A: Desde el Panel Admin (Recomendado - Próxima versión)**
   - Crear campaña con tipo "live_youtube"
   - El sistema generará automáticamente links de confirmación

2. **Opción B: Desde la API (Actual)**

   **Endpoint:** `POST /api/admin/campaigns/events`

   **Headers:**
   ```
   Authorization: Bearer [tu_token_admin]
   Content-Type: application/json
   ```

   **Body:**
   ```json
   {
     "eventType": "live_youtube",
     "eventName": "Primer Live - Explicación del Proceso Electoral",
     "eventDate": "2025-01-20T19:00:00Z",
     "targetRole": null,
     "emailSubject": "Invitación al Live de YouTube - {eventName}",
     "emailContent": "<h2>Hola {firstName},</h2><p>Te invitamos a nuestro primer live en YouTube donde explicaremos:</p><ul><li>El proceso electoral</li><li>Cómo funciona el sistema</li><li>Cómo realizar el conteo</li></ul><p><strong>Fecha:</strong> {eventDate}</p><p><a href=\"{confirmationUrl}\" style=\"background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Confirmar Asistencia</a></p><p>O copia este link: {confirmationUrl}</p>",
     "whatsappContent": "Hola {firstName}! 🎥\n\nTe invitamos a nuestro primer LIVE en YouTube:\n\n📺 {eventName}\n📅 {eventDate}\n\nExplicaremos:\n• El proceso electoral\n• Cómo funciona el sistema\n• Cómo hacer el conteo\n\nConfirma tu asistencia aquí:\n{confirmationUrl}"
   }
   ```

3. **Resultado:**
   - Se crean confirmaciones para todos los voluntarios
   - Cada uno recibe un link único
   - Se envían email + WhatsApp con el link
   - Los voluntarios pueden confirmar en `/confirmar/[token]`

4. **Ver confirmaciones:**
   - Usar API: `GET /api/admin/campaigns/events` (pendiente implementar)
   - O consultar directamente en BD: tabla `event_confirmations`

---

## 🔌 API Endpoints

### Campañas

#### Listar Campañas
```
GET /api/admin/campaigns?page=1&limit=20&status=draft
Headers: Authorization: Bearer [token]
```

#### Crear Campaña
```
POST /api/admin/campaigns
Headers: Authorization: Bearer [token]
Content-Type: application/json

Body:
{
  "name": "Nombre de la campaña",
  "description": "Descripción opcional",
  "eventType": "live_youtube" | "training" | "meeting" | "other",
  "eventDate": "2025-01-20T19:00:00Z",
  "emailSubject": "Asunto del email",
  "emailContent": "<p>Contenido HTML</p>",
  "whatsappContent": "Contenido de WhatsApp",
  "targetRole": "OBSERVER" | "VOLUNTEER" | null,
  "targetJrv": "010101" | null,
  "scheduledAt": "2025-01-20T19:00:00Z"
}
```

#### Enviar Campaña
```
POST /api/admin/campaigns/[id]/send
Headers: Authorization: Bearer [token]
```

### Eventos con Confirmación

#### Crear Evento
```
POST /api/admin/campaigns/events
Headers: Authorization: Bearer [token]
Content-Type: application/json

Body:
{
  "eventType": "live_youtube",
  "eventName": "Primer Live",
  "eventDate": "2025-01-20T19:00:00Z",
  "targetRole": "OBSERVER" | "VOLUNTEER" | null,
  "targetJrv": "010101" | null,
  "emailSubject": "Invitación - {eventName}",
  "emailContent": "<p>Hola {firstName}...</p><a href=\"{confirmationUrl}\">Confirmar</a>",
  "whatsappContent": "Hola {firstName}! Confirma: {confirmationUrl}"
}
```

### Confirmación

#### Ver Información de Confirmación
```
GET /api/confirm/[token]
```

#### Confirmar Asistencia
```
POST /api/confirm/[token]
Content-Type: application/json

Body:
{
  "status": "confirmed" | "declined" | "maybe",
  "notes": "Comentarios opcionales"
}
```

---

## 🎨 Variables Disponibles en Templates

Al crear campañas o eventos, puedes usar estas variables en el contenido:

### En Email y WhatsApp:

- `{firstName}` - Nombre del voluntario
- `{lastName}` - Apellido del voluntario
- `{eventName}` - Nombre del evento
- `{eventDate}` - Fecha formateada del evento
- `{confirmationUrl}` - Link único de confirmación (solo en eventos)

### Ejemplo de uso:

**Email:**
```html
<h2>Hola {firstName} {lastName},</h2>
<p>Te invitamos a {eventName} el {eventDate}</p>
<p><a href="{confirmationUrl}">Confirmar asistencia</a></p>
```

**WhatsApp:**
```
Hola {firstName}! 👋

Te invitamos a {eventName}
📅 {eventDate}

Confirma: {confirmationUrl}
```

---

## 🐛 Troubleshooting

### Problema: Emails no se envían

**Verificar:**
1. ✅ `RESEND_API_KEY` está configurado
2. ✅ `RESEND_FROM_EMAIL` está verificado en Resend
3. ✅ Verificar en Resend Dashboard → Emails si hay errores
4. ✅ Revisar logs del servidor para ver errores específicos

**Soluciones comunes:**
- Si el error es "The from address is not verified":
  - Verifica el email en Resend → Settings → Domains (o verifica tu email)
  - Usa el email exacto verificado
- Si el error es de rate limit:
  - Resend permite 100 emails/día en plan gratuito
  - Espera o actualiza a un plan superior

### Problema: WhatsApp no se envía

**Verificar:**
1. ✅ `CHATAPI_API_KEY` y `CHATAPI_INSTANCE_ID` están configurados
2. ✅ `CHATAPI_PHONE_NUMBER` tiene el formato correcto: `+504XXXXXXXX`
3. ✅ WhatsApp está conectado en ChatAPI (revisar estado de la instancia)
4. ✅ Revisar ChatAPI Dashboard → Messages → Errors

**Soluciones comunes:**
- Si el error es "Instance not connected":
  - Ve a ChatAPI Dashboard y verifica que WhatsApp esté conectado
  - Si no está conectado, escanea el QR code nuevamente
- Si el error es "Invalid phone number":
  - Verifica el formato: debe empezar con `+` seguido del código país
  - Para Honduras: `+504XXXXXXXX`
- Si el error es de rate limit:
  - ChatAPI tiene límites de mensajes por minuto
  - Reduce la velocidad de envío o actualiza el plan

### Problema: Links de confirmación no funcionan

**Verificar:**
1. ✅ `APP_BASE_URL` está configurado correctamente
2. ✅ La URL es accesible públicamente
3. ✅ El token existe en la base de datos

**Solución:**
- Revisar que `APP_BASE_URL` no tenga trailing slash
- Verificar que la migración se aplicó correctamente

### Problema: Errores de base de datos

**Solución:**
```bash
# Regenerar cliente Prisma
npx prisma generate

# Aplicar migraciones pendientes
npx prisma migrate deploy

# Verificar estado
npx prisma migrate status
```

---

## 📊 Estructura de Base de Datos

### Tabla: `campaigns`
Almacena las campañas de broadcast

### Tabla: `campaign_recipients`
Rastrea cada destinatario y el estado de entrega del mensaje

### Tabla: `event_confirmations`
Almacena las confirmaciones de asistencia a eventos

---

## 🔒 Seguridad

- Todos los endpoints de admin requieren autenticación JWT
- Solo usuarios con rol `ADMIN` pueden crear/enviar campañas
- Los tokens de confirmación son únicos y seguros (32 bytes random)
- Las API keys nunca se exponen al frontend

---

## 📈 Próximas Mejoras

- [ ] Dashboard de estadísticas de confirmaciones en panel admin
- [ ] Recordatorios automáticos días antes del evento
- [ ] Exportar lista de confirmados a CSV
- [ ] Crear eventos desde el panel admin (sin usar API directamente)
- [ ] Preview de emails antes de enviar
- [ ] Programación de campañas (enviar en fecha/hora específica)

---

## 📞 Soporte

Si tienes problemas:

1. Revisa la sección [Troubleshooting](#troubleshooting)
2. Verifica los logs del servidor
3. Revisa los dashboards de Resend y ChatAPI
4. Verifica que todas las variables de entorno estén configuradas

---

**Última actualización:** Enero 2025

