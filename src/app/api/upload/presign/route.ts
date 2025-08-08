import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';
import { AuthUtils } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    if (!token) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const payload = AuthUtils.verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });

    if (!env.AWS_S3_BUCKET || !env.AWS_REGION) {
      return NextResponse.json({ success: false, error: 'S3 no está configurado' }, { status: 400 });
    }

    const body = await request.json();
    const { escrutinioId, fileName, contentType } = body as { escrutinioId: string; fileName: string; contentType: string };
    if (!escrutinioId || !fileName || !contentType) {
      return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Basic content-type validation
    if (!/^image\/(png|jpe?g)$/i.test(contentType)) {
      return NextResponse.json({ success: false, error: 'Tipo de archivo no permitido' }, { status: 400 });
    }

    const key = `escrutinios/${encodeURIComponent(escrutinioId)}/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;

    const s3 = new S3Client({ region: env.AWS_REGION });
    const command = new PutObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

    return NextResponse.json({ success: true, data: { uploadUrl, publicUrl, key } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Error generando URL de subida' }, { status: 500 });
  }
}


