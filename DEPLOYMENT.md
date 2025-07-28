# 🚀 Guía de Deployment - Escrutinio Transparente

## 📋 Prerrequisitos

- Node.js 18.17.0+
- Cuenta de Vercel
- Base de datos PostgreSQL (Railway, Neon, Supabase, etc.)

## 🔧 Variables de Entorno Requeridas

### **Obligatorias:**
```env
DATABASE_URL="postgresql://user:pass@host:port/database"
NEXTAUTH_SECRET="tu-secreto-super-seguro-32-caracteres"
JWT_SECRET="tu-jwt-secret-super-seguro"
ENCRYPTION_KEY="tu-clave-de-32-caracteres-exactos123"
```

### **Opcionales:**
```env
NEXTAUTH_URL="https://tu-dominio.vercel.app"
AWS_ACCESS_KEY_ID="tu-aws-key"
AWS_SECRET_ACCESS_KEY="tu-aws-secret"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="escrutinio-images"
```

## 🚀 Deployment en Vercel

### **1. Preparar el Repositorio**
```bash
# Asegúrate de que todo esté committeado
git add .
git commit -m "feat: Sistema completo de escrutinio electoral"
git push origin main
```

### **2. Conectar con Vercel**
1. Ve a [vercel.com](https://vercel.com)
2. Importa tu repositorio de GitHub
3. Configura las variables de entorno
4. Deploy automático

### **3. Configurar Base de Datos**
```bash
# En Vercel, agrega estas variables:
DATABASE_URL="tu-url-de-postgresql"
NEXTAUTH_SECRET="genera-un-secreto-seguro"
JWT_SECRET="genera-otro-secreto-seguro"
ENCRYPTION_KEY="tu-clave-de-32-caracteres"
```

### **4. Ejecutar Migraciones**
```bash
# En Vercel, agrega este comando de build:
npm run db:generate && npm run db:migrate && npm run db:seed
```

## 🔐 Credenciales de Producción

### **Cambiar en Producción:**
- ✅ Todas las claves por defecto
- ✅ URLs de desarrollo
- ✅ Configuración de base de datos

### **Credenciales de Prueba:**
```
👤 Admin: admin@escrutinio.com / admin123
🔍 Auditor: auditor@escrutinio.com / auditor123
```

## 📊 Funcionalidades Implementadas

### **✅ Completadas:**
- 🔐 Autenticación segura con JWT
- 🗳️ Proceso completo de escrutinio (3 pasos)
- 📊 Resultados en tiempo real
- 🔍 Sistema de auditoría completo
- 📱 Interfaz responsive
- 🗺️ Geolocalización GPS
- 📸 Carga de evidencia
- 🔒 Vinculación de dispositivos

### **🎯 URLs Principales:**
- `/` - Login/Registro
- `/dashboard` - Panel principal
- `/escrutinio` - Proceso de conteo
- `/resultados` - Resultados públicos
- `/auditoria` - Logs de auditoría

## 🛡️ Seguridad

### **Implementada:**
- ✅ Encriptación AES-256
- ✅ JWT con expiración
- ✅ Validación de dispositivos
- ✅ Logs de auditoría
- ✅ Sanitización de datos
- ✅ CORS configurado

### **Recomendaciones para Producción:**
- 🔒 Usar HTTPS
- 🔒 Rate limiting
- 🔒 Monitoreo de logs
- 🔒 Backup automático
- 🔒 Certificados SSL

## 📈 Monitoreo

### **Métricas a Seguir:**
- 📊 Usuarios activos
- 🗳️ Escrutinios completados
- ⚡ Tiempo de respuesta
- 🔍 Logs de auditoría
- 🚨 Errores del sistema

## 🆘 Soporte

### **En Caso de Problemas:**
1. Verificar variables de entorno
2. Revisar logs de Vercel
3. Verificar conexión a base de datos
4. Comprobar migraciones ejecutadas

---

**¡Sistema listo para elecciones transparentes! 🗳️✨** 