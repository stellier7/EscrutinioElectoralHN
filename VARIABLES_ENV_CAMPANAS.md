# 🔐 Variables de Entorno - Campañas y Broadcast

## ⚡ Resumen Rápido

Copia estas variables a tu archivo `.env` y en Vercel:

```env
# ============================================
# EMAIL (Resend)
# ============================================
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@escrutinio.com
RESEND_FROM_NAME=Escrutinio Transparente

# ============================================
# WHATSAPP (ChatAPI)
# ============================================
CHATAPI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CHATAPI_INSTANCE_ID=123456789
CHATAPI_PHONE_NUMBER=+504XXXXXXXX

# ============================================
# URL BASE (Opcional pero recomendado)
# ============================================
APP_BASE_URL=https://escrutinio-electoral-hn-4diq.vercel.app
```

---

## 📍 Dónde Crear Cuentas

### Resend (Emails)
🌐 **URL:** https://resend.com/

**Pasos rápidos:**
1. Registrarse en https://resend.com/
2. Verificar tu email (solo requiere verificar email, NO número de teléfono)
3. API Keys → Create API Key
4. Copiar API Key a `RESEND_API_KEY`
5. Usar tu email verificado en `RESEND_FROM_EMAIL`

📖 **Plan Gratuito:** 100 emails/día (similar a SendGrid)
📖 **Ventaja:** Solo requiere verificar email, no dominio ni número de teléfono

---

### ChatAPI (WhatsApp)
🌐 **URL:** https://chat-api.com/

**Pasos rápidos:**
1. Registrarse en https://chat-api.com/
2. Crear una instancia de WhatsApp
3. Conectar tu WhatsApp (escanea QR code con tu teléfono)
4. Obtener:
   - **API Key** → Copiar a `CHATAPI_API_KEY`
   - **Instance ID** → Copiar a `CHATAPI_INSTANCE_ID`
   - **Phone Number** → Copiar a `CHATAPI_PHONE_NUMBER`

📖 **Plan Gratuito:** Limitado pero suficiente para empezar
📖 **Ventaja:** No requiere verificación de número de teléfono para la cuenta, solo conectar WhatsApp

**Nota:** ChatAPI requiere conectar un WhatsApp real (escaneando QR), pero NO requiere verificar número de teléfono para crear la cuenta del servicio.

---

## ✅ Checklist de Configuración

- [ ] Cuenta creada en Resend
- [ ] Email verificado en Resend (solo email, no teléfono)
- [ ] API Key creada en Resend
- [ ] `RESEND_API_KEY` configurado
- [ ] `RESEND_FROM_EMAIL` configurado (email verificado)
- [ ] `RESEND_FROM_NAME` configurado

- [ ] Cuenta creada en ChatAPI
- [ ] Instancia de WhatsApp creada
- [ ] WhatsApp conectado (QR escaneado)
- [ ] `CHATAPI_API_KEY` configurado
- [ ] `CHATAPI_INSTANCE_ID` configurado
- [ ] `CHATAPI_PHONE_NUMBER` configurado

- [ ] `APP_BASE_URL` configurado (para links de confirmación)
- [ ] Migración de BD aplicada: `npx prisma migrate deploy`
- [ ] Cliente Prisma regenerado: `npx prisma generate`

---

## 🔍 Verificar Configuración

### Test Email
1. Registrar un voluntario en `/voluntarios`
2. Verificar que llegue email automático
3. Revisar Resend Dashboard → Emails

### Test WhatsApp
1. Asegurarse de que WhatsApp esté conectado en ChatAPI
2. Registrar un voluntario
3. Verificar que llegue WhatsApp automático
4. Revisar ChatAPI Dashboard → Messages

---

**Más detalles:** Ver `CAMPAÑAS_Y_BROADCAST.md`
