import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing S3 configuration...');
    
    const s3Config = {
      AWS_S3_BUCKET: !!env.AWS_S3_BUCKET,
      AWS_REGION: env.AWS_REGION,
      AWS_ACCESS_KEY_ID: !!env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!env.AWS_SECRET_ACCESS_KEY,
      NODE_ENV: env.NODE_ENV
    };
    
    console.log('🧪 S3 Configuration:', s3Config);
    
    // Test if we can create an S3 client
    let s3ClientCreated = false;
    let s3Error = null;
    
    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({ region: env.AWS_REGION });
      s3ClientCreated = true;
      console.log('🧪 S3 Client created successfully');
    } catch (error: any) {
      s3Error = error.message;
      console.error('🧪 S3 Client creation failed:', error);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        s3Config,
        s3ClientCreated,
        s3Error,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('🧪 S3 Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      data: {
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}
