# 🗳️ Escrutinio Transparente

Sistema MVP de **registro, verificación y transmisión de resultados electorales** construido con Next.js, PostgreSQL y tecnologías modernas. Diseñado para elecciones ciudadanas con máxima transparencia y seguridad.

## 🎯 Características Principales

### ✅ **Sistema Completo**
- 🔐 **Autenticación segura** con roles (Voluntario/Miembro de Organización)
- 📱 **Vinculación de dispositivos** (un dispositivo por usuario)
- 🗺️ **Geolocalización automática** al iniciar escrutinio
- 📊 **Ingreso de resultados** por candidato/partido
- 📸 **Carga de evidencia** (imágenes del acta firmada)
- 🔒 **Transmisión cifrada** de datos
- 📋 **Dashboard público** de resultados en tiempo real
- 🔍 **Sistema de auditoría** completo con logs detallados

### 🛡️ **Seguridad y Trazabilidad**
- Encriptación AES-256 para datos sensibles
- Hash de validación para integridad de datos
- Logs de auditoría para todas las acciones
- Control de dispositivos autorizados
- JWT para autenticación con expiración

---

## 🚀 Instalación y Configuración

### **Prerrequisitos**

- Node.js 18.17.0 o superior
- PostgreSQL 13+ (local o remoto)
- Cuenta de AWS S3 (opcional, para imágenes)

### **1. Clonar el Repositorio**

```bash
git clone https://github.com/tu-usuario/escrutinio-transparente.git
cd escrutinio-transparente
```

### **2. Instalar Dependencias**

```bash
npm install
```

### **3. Configurar Variables de Entorno**

Crea un archivo `.env` en la raíz del proyecto:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/escrutinio_transparente"

# Authentication
NEXTAUTH_SECRET="tu-secreto-nextauth-super-seguro-cambia-esto"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="tu-jwt-secret-super-seguro-cambia-esto"

# Encryption
ENCRYPTION_KEY="tu-clave-de-32-caracteres-exactos123"

# AWS S3 (Opcional - para almacenamiento de imágenes)
AWS_ACCESS_KEY_ID="tu-aws-access-key"
AWS_SECRET_ACCESS_KEY="tu-aws-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="escrutinio-images"

# App Configuration
APP_ENV="production"
NODE_ENV="production"
```

### **4. Configurar Base de Datos**

```bash
# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Poblar datos iniciales
npm run db:seed
```

### **5. Ejecutar la Aplicación**

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm run start
```

La aplicación estará disponible en `http://localhost:3000`

---

## 👤 Usuario por Defecto

Después del seed, puedes usar estas credenciales:

```
Email: admin@escrutinio.com
Contraseña: admin123
Rol: Administrador
```

---

## 🏗️ Arquitectura del Sistema

### **Frontend**
- **Next.js 14** con App Router
- **React 18** con hooks personalizados
- **Tailwind CSS** para estilos responsivos
- **TypeScript** para tipado fuerte

### **Backend**
- **Next.js API Routes** para endpoints REST
- **Prisma ORM** para acceso a base de datos
- **JWT** para autenticación
- **Middleware** personalizado para autorización

### **Base de Datos**
- **PostgreSQL** como base de datos principal
- **Esquema optimizado** para relaciones electorales
- **Índices** para consultas rápidas

### **Seguridad**
- **Encriptación AES-256** para datos sensibles
- **Validación de esquemas** con Zod
- **Sanitización** de entrada de datos
- **CORS** configurado correctamente

---

## 📊 Funcionalidades Detalladas

### **1. Registro e Inicio de Sesión**
- Formulario de registro con validación
- Login con email y contraseña
- Vinculación automática de dispositivo
- Roles: Voluntario o Miembro de Organización

### **2. Proceso de Escrutinio**
- Selección de mesa (JRV) y nivel electoral
- Captura automática de GPS con precisión
- Validación de ubicación dentro de rangos permitidos

### **3. Ingreso de Resultados**
- Lista dinámica de candidatos por nivel electoral
- Validación de datos numéricos
- Sistema de correcciones con registro de auditoría
- Cálculo automático de totales

### **4. Carga de Evidencia**
- Captura/upload de imagen del acta
- Generación automática de hash para integridad
- Almacenamiento seguro (local o S3)
- Vinculación con datos del escrutinio

### **5. Transmisión y Backend**
- Envío cifrado de datos completos
- Validación de integridad en servidor
- Estado de transmisión en tiempo real
- Logs detallados de todo el proceso

### **6. Dashboard Público**
- Resultados en tiempo real por nivel electoral
- Porcentajes y gráficos automáticos
- Filtros por mesa y candidato
- Estado de transmisión por mesa

### **7. Sistema de Auditoría**
- Log de todas las acciones del sistema
- Metadatos completos (IP, User-Agent, etc.)
- Filtros por usuario, acción y fecha
- Exportación de reportes de auditoría

---

## 🔧 Configuración Avanzada

### **Personalización de Seguridad**

```typescript
// src/config/security.ts
export const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  SESSION_TIMEOUT: 3600, // 1 hora
  GEOLOCATION_ACCURACY: 100, // metros
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png'],
};
```

### **Configuración de Base de Datos**

Para usar con servicios cloud:

```env
# Railway
DATABASE_URL="postgresql://user:pass@containers-us-west-xxx.railway.app:5432/railway"

# Render
DATABASE_URL="postgresql://user:pass@dpg-xxx-a.oregon-postgres.render.com/dbname"

# Neon
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb"
```

---

## 📱 Uso del Sistema

### **Para Voluntarios/Miembros de Mesa:**

1. **Registro**: Crear cuenta con email y rol
2. **Inicio de Escrutinio**: Seleccionar mesa y nivel electoral
3. **Autorización de Ubicación**: Permitir acceso al GPS
4. **Ingreso de Votos**: Completar conteo por candidato
5. **Carga de Evidencia**: Fotografiar/subir acta firmada
6. **Transmisión**: Enviar datos cifrados al servidor

### **Para el Público:**

1. **Dashboard**: Acceso libre a resultados en tiempo real
2. **Filtros**: Ver resultados por nivel electoral
3. **Transparencia**: Estado de transmisión por mesa
4. **Gráficos**: Visualización automática de porcentajes

---

## 🚀 Deployment en Producción

### **Opción 1: Vercel + Railway**

```bash
# Vercel (Frontend)
npm i -g vercel
vercel --prod

# Railway (Database)
# Crear proyecto en railway.app y conectar PostgreSQL
```

### **Opción 2: VPS Completo**

```bash
# En tu servidor
git clone [repo]
cd escrutinio-transparente
npm install
npm run build

# Configurar PM2
npm i -g pm2
pm2 start npm --name "escrutinio" -- start
pm2 startup
pm2 save
```

### **Opción 3: Docker**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 🔒 Consideraciones de Seguridad

### **En Producción:**
- ✅ Cambiar todas las claves por defecto
- ✅ Usar HTTPS con certificados SSL
- ✅ Configurar CORS restrictivo
- ✅ Implementar rate limiting
- ✅ Habilitar logs de seguridad
- ✅ Backup automático de base de datos

### **Monitoreo:**
- Logs de auditoría en tiempo real
- Alertas por intentos de acceso sospechosos
- Métricas de performance y disponibilidad
- Backup incremental de datos críticos

---

## 🤝 Contribuciones

Este es un sistema MVP. Las mejoras sugeridas incluyen:

- **WebSockets** para actualizaciones en tiempo real
- **Notificaciones push** para móviles
- **API REST completa** para integraciones
- **Tests automatizados** unitarios e integración
- **Docker Compose** para desarrollo local

---

## 📄 Licencia

**MIT License** - Uso libre para elecciones democráticas y transparentes.

---

## 📞 Soporte

Para problemas técnicos o consultas:

- **Email**: soporte@escrutinio-transparente.org
- **Issues**: GitHub Issues de este repositorio
- **Documentación**: Ver `/docs` para detalles técnicos

---

**¡Construyamos elecciones más transparentes y confiables juntos! 🗳️✊** 