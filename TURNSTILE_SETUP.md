# Configuración de Cloudflare Turnstile CAPTCHA

Esta guía explica cómo configurar Cloudflare Turnstile CAPTCHA en el formulario de registro de voluntarios.

## Características Implementadas

✅ **100% gratuito sin límites**
✅ **Validación en backend (Next.js API route)**
✅ **Manejo de errores completo**
✅ **Estados de carga**
✅ **Reset automático en errores**
✅ **TypeScript**
✅ **Sin complicar UX**

## Pasos de Configuración

### 1. Crear Cuenta en Cloudflare (Gratis)

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Crea una cuenta gratuita si no tienes una
3. No se requiere tarjeta de crédito

### 2. Configurar Turnstile

1. En el dashboard de Cloudflare, ve a **Security** → **Turnstile**
2. Haz clic en **Add Site**
3. Completa el formulario:
   - **Site name**: Nombre descriptivo (ej: "Escrutinio Transparente")
   - **Domain**: Tu dominio de producción (ej: `escrutinio-transparente.vercel.app`)
   - **Widget Mode**: 
     - **Managed**: Recomendado para mejor UX (invisible en la mayoría de casos)
     - **Non-interactive**: Siempre visible pero no requiere interacción
     - **Invisible**: Completamente invisible (puede ser más estricto)
4. Haz clic en **Create**

### 3. Obtener las Claves

Después de crear el sitio, verás:
- **Site Key** (pública): Se usa en el frontend
- **Secret Key** (privada): Se usa en el backend

### 4. Configurar Variables de Entorno

#### Desarrollo Local (.env)

Agrega estas variables a tu archivo `.env`:

```env
# Cloudflare Turnstile CAPTCHA
NEXT_PUBLIC_TURNSTILE_SITE_KEY=tu_site_key_aqui
TURNSTILE_SECRET_KEY=tu_secret_key_aqui
```

#### Producción (Vercel)

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Navega a **Settings** → **Environment Variables**
3. Agrega las siguientes variables:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = Tu Site Key
   - `TURNSTILE_SECRET_KEY` = Tu Secret Key
4. Asegúrate de seleccionar los entornos correctos (Production, Preview, Development)
5. Haz clic en **Save**

### 5. Configurar Dominios Adicionales (Opcional)

Si necesitas probar en desarrollo local o en otros dominios:

1. En Cloudflare Turnstile, edita tu sitio
2. Agrega dominios adicionales en la sección **Domains**:
   - `localhost` (para desarrollo local)
   - `*.vercel.app` (para previews de Vercel)
   - Tu dominio de producción

### 6. Verificar la Implementación

1. Reinicia tu servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Navega a `/voluntarios`
3. Deberías ver el widget de Turnstile antes del botón "Crear cuenta"
4. Completa el formulario y verifica que el CAPTCHA se valide correctamente

## Modo de Desarrollo

Si no configuras las variables de entorno, el CAPTCHA se deshabilitará automáticamente en desarrollo. Verás un warning en la consola:

```
⚠️ Turnstile SECRET_KEY not configured. Skipping CAPTCHA validation.
```

Esto permite desarrollar sin necesidad de configurar Turnstile, pero **debes configurarlo en producción**.

## Manejo de Errores

El sistema maneja automáticamente los siguientes errores:

### Errores del Backend

- **Token inválido**: "Token de CAPTCHA inválido"
- **Token expirado**: "El CAPTCHA expiró o ya fue usado. Por favor, intenta de nuevo."
- **Error de configuración**: "Error de configuración del servidor"
- **Error interno**: "Error interno del servicio de CAPTCHA"

### Errores del Frontend

- **Error de carga**: El widget muestra un mensaje de error
- **Expiración**: El widget se resetea automáticamente
- **Error de validación**: El formulario muestra el error y resetea el CAPTCHA

## Personalización

### Cambiar el Tema

En `src/app/voluntarios/page.tsx`, puedes cambiar el tema del widget:

```typescript
options={{
  theme: 'light', // o 'dark' o 'auto'
  size: 'normal', // o 'compact'
}}
```

### Modo Invisible

Para usar el modo invisible (más estricto pero mejor UX):

1. En Cloudflare, cambia el **Widget Mode** a **Invisible**
2. El widget se mostrará automáticamente solo cuando sea necesario

## Troubleshooting

### El CAPTCHA no aparece

- Verifica que `NEXT_PUBLIC_TURNSTILE_SITE_KEY` esté configurado
- Verifica que el dominio esté agregado en Cloudflare Turnstile
- Revisa la consola del navegador para errores

### Error "Token inválido" en producción

- Verifica que `TURNSTILE_SECRET_KEY` esté configurado en Vercel
- Verifica que el dominio en Cloudflare coincida con tu dominio de producción
- Asegúrate de que las variables de entorno estén en el entorno correcto

### El CAPTCHA se resetea constantemente

- Verifica que no haya múltiples instancias del widget
- Asegúrate de que el token se envíe correctamente en el request

## Seguridad

- ✅ El **Site Key** es pública y puede estar en el código del cliente
- ✅ El **Secret Key** debe mantenerse privada y solo usarse en el servidor
- ✅ La validación siempre se hace en el backend
- ✅ Los tokens de Turnstile expiran después de un tiempo (por seguridad)

## Recursos

- [Documentación oficial de Turnstile](https://developers.cloudflare.com/turnstile/)
- [React Turnstile Component](https://github.com/marsidev/react-turnstile)
- [API de Verificación de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

