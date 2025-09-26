import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('📸 Presign API called');
    
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

    if (!env.AWS_S3_BUCKET || !env.AWS_REGION) {
      console.log('❌ S3 no está configurado');
      return NextResponse.json({ success: false, error: 'S3 no está configurado' }, { status: 400 });
    }

    const body = await request.json();
    console.log('📸 Presign request body:', body);
    const { escrutinioId, fileName, contentType } = body as { escrutinioId: string; fileName: string; contentType: string };
    console.log('📸 Parsed parameters:', { escrutinioId, fileName, contentType });
    
    if (!escrutinioId || !fileName || !contentType) {
      console.log('❌ Parámetros inválidos:', { hasEscrutinioId: !!escrutinioId, hasFileName: !!fileName, hasContentType: !!contentType });
      return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Basic content-type validation
    console.log('📸 Validating content-type:', contentType);
    if (!/^image\/(png|jpe?g)$/i.test(contentType)) {
      console.log('❌ Tipo de archivo no permitido:', contentType);
      return NextResponse.json({ success: false, error: 'Tipo de archivo no permitido' }, { status: 400 });
    }

    const key = `escrutinios/${encodeURIComponent(escrutinioId)}/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;

    console.log('📸 Generating S3 presigned URL:', { key, contentType });
    
    const s3 = new S3Client({ region: env.AWS_REGION });
    const command = new PutObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

    console.log('📸 Presigned URL generated successfully:', { uploadUrl: uploadUrl.substring(0, 50) + '...', publicUrl, key });

    return NextResponse.json({ success: true, data: { uploadUrl, publicUrl, key } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Error generando URL de subida' }, { status: 500 });
  }
}


