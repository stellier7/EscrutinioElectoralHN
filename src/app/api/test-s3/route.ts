import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('📸 Test S3 API called');

    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    console.log('📸 AWS S3 Configuration check:', {
      AWS_S3_BUCKET: !!env.AWS_S3_BUCKET,
      AWS_REGION: env.AWS_REGION,
      AWS_ACCESS_KEY_ID: !!env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!env.AWS_SECRET_ACCESS_KEY
    });

    if (!env.AWS_S3_BUCKET || !env.AWS_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
      console.log('❌ S3 no está configurado correctamente. Faltan variables de entorno.');
      return NextResponse.json({ 
        success: false, 
        error: 'S3 no está configurado correctamente. Faltan variables de entorno.',
        details: {
          hasBucket: !!env.AWS_S3_BUCKET,
          hasRegion: !!env.AWS_REGION,
          hasAccessKey: !!env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!env.AWS_SECRET_ACCESS_KEY
        }
      }, { status: 400 });
    }

    // Test creating a presigned URL
    const testKey = `test-s3/test-${Date.now()}.txt`;
    const s3 = new S3Client({ 
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    const command = new PutObjectCommand({ 
      Bucket: env.AWS_S3_BUCKET, 
      Key: testKey, 
      ContentType: 'text/plain' 
    });
    
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
    const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${testKey}`;

    console.log('✅ S3 Test successful:', { uploadUrl: uploadUrl.substring(0, 50) + '...', publicUrl, testKey });

    return NextResponse.json({ 
      success: true, 
      message: 'S3 configurado correctamente',
      data: { 
        publicUrl,
        testKey,
        uploadUrl: uploadUrl.substring(0, 100) + '...'
      }
    });
  } catch (e: any) {
    console.error('❌ Error en Test S3 API:', e);
    return NextResponse.json({ 
      success: false, 
      error: e?.message || 'Error interno en el test de S3',
      details: e
    }, { status: 500 });
  }
}