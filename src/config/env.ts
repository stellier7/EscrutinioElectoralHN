import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Authentication
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  
  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  
  // Encryption
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  
  // App Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.string().default('production'),
  ALLOWED_ORIGINS: z.string().optional(),
  
  // Optional services
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  
  // Email service (Resend)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  
  // WhatsApp service (ChatAPI)
  CHATAPI_API_KEY: z.string().optional(),
  CHATAPI_INSTANCE_ID: z.string().optional(),
  CHATAPI_PHONE_NUMBER: z.string().optional(),
  
  // App base URL for links
  APP_BASE_URL: z.string().url().optional(),
  
  // Seed secret for production
  SEED_SECRET: z.string().optional(),
});

// Parse environment variables with better error handling
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error);
  
  // In development, we can be more lenient
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Using development fallback environment variables');
    env = {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dummy:pass@localhost:5432/dummy',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'dev-secret-only-for-development',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-only-for-development',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'dev-32-char-encryption-key-123',
      NODE_ENV: 'development',
      APP_ENV: 'development',
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      SENTRY_DSN: process.env.SENTRY_DSN,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
      RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
      CHATAPI_API_KEY: process.env.CHATAPI_API_KEY,
      CHATAPI_INSTANCE_ID: process.env.CHATAPI_INSTANCE_ID,
      CHATAPI_PHONE_NUMBER: process.env.CHATAPI_PHONE_NUMBER,
      APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
      SEED_SECRET: process.env.SEED_SECRET || 'dev-seed-secret',
    } as any;
  } else {
    // In production, provide more specific error information
    const missingVars = [];
    if (!process.env.DATABASE_URL) missingVars.push('DATABASE_URL');
    if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET');
    if (!process.env.ENCRYPTION_KEY) missingVars.push('ENCRYPTION_KEY');
    if (!process.env.NEXTAUTH_SECRET) missingVars.push('NEXTAUTH_SECRET');
    
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

export { env };

// Export type for usage
export type Env = typeof env; 