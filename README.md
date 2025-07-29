# Escrutinio Transparente

Sistema de registro, verificación y transmisión de resultados electorales para Honduras.

## Características

- 🔐 Autenticación segura con JWT
- 📱 Captura de ubicación GPS
- 📊 Dashboard en tiempo real
- 🔍 Auditoría completa
- 📈 Resultados públicos
- 🗳️ Escrutinio transparente

## Tecnologías

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Base de datos:** PostgreSQL (Supabase)
- **Autenticación:** JWT, bcryptjs
- **Deployment:** Vercel

## Configuración Rápida

### 1. Clonar el repositorio
```bash
git clone https://github.com/stellier7/EscrutinioElectoralHN.git
cd EscrutinioElectoralHN
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto:
```env
DATABASE_URL="postgresql://postgres.jjkpeossvumgqcvdnzpl:Infinita2025%25@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
NEXTAUTH_SECRET="tu-secret-aqui"
JWT_SECRET="tu-jwt-secret-aqui"
ENCRYPTION_KEY="tu-encryption-key-aqui"
```

### 4. Configurar la base de datos
```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```

## Usuarios de Prueba

### Administrador
- **Email:** admin@escrutinio.com
- **Password:** admin123

### Auditor
- **Email:** auditor@escrutinio.com
- **Password:** auditor123

## Guía de Deployment

### Vercel

1. **Conectar repositorio** en Vercel
2. **Configurar variables de entorno:**
   - `DATABASE_URL`: URL de Supabase con Transaction Pooler
   - `NEXTAUTH_SECRET`: Secret para NextAuth
   - `JWT_SECRET`: Secret para JWT
   - `ENCRYPTION_KEY`: Clave de encriptación

3. **Configurar base de datos:**
   - Usar **Transaction Pooler** en Supabase (IPv4 compatible)
   - URL: `postgresql://postgres.jjkpeossvumgqcvdnzpl:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

4. **Después del deployment:**
   ```bash
   curl -X POST https://tu-dominio.vercel.app/api/setup
   ```

## Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/          # Autenticación
│   │   ├── results/       # Resultados públicos
│   │   └── setup/         # Configuración inicial
│   ├── dashboard/         # Dashboard principal
│   ├── escrutinio/        # Escrutinio de votos
│   ├── resultados/        # Resultados públicos
│   └── auditoria/         # Auditoría del sistema
├── components/            # Componentes React
├── lib/                   # Utilidades
├── hooks/                 # Custom hooks
├── types/                 # Tipos TypeScript
└── middleware/            # Middleware de autenticación
```

## Funcionalidades

### 🔐 Autenticación
- Registro de usuarios
- Login con JWT
- Roles: Admin, Auditor, Voluntario, Miembro de Organización
- Captura de ubicación GPS

### 📊 Dashboard
- Vista general del sistema
- Navegación a funcionalidades
- Estado de autenticación

### 🗳️ Escrutinio
- Captura de votos por candidato
- Validación de datos
- Transmisión de resultados
- Captura de fotos de actas

### 📈 Resultados
- Visualización pública de resultados
- Gráficos en tiempo real
- Filtros por nivel electoral

### 🔍 Auditoría
- Log de todas las acciones
- Filtros por usuario, acción y fecha
- Exportación de datos

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

Para soporte técnico, contacta al equipo de desarrollo.

---

**Sistema optimizado para elecciones reales en Honduras** 🗳️✨ 