import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [HEALTH CHECK] Starting comprehensive health check...');
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {} as any
    };

    // 1. Database Connection (Neon)
    try {
      console.log('🔍 [HEALTH CHECK] Testing database connection...');
      const startTime = Date.now();
      
      // Test basic query
      const testQuery = await prisma.$queryRaw`SELECT 1 as test`;
      const dbResponseTime = Date.now() - startTime;
      
      // Get database info
      const dbInfo = await prisma.$queryRaw`
        SELECT 
          current_database() as database_name,
          version() as postgres_version,
          pg_database_size(current_database()) as database_size_bytes
      ` as any[];
      
      // Get table counts
      const tableCounts = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables 
        ORDER BY n_live_tup DESC
        LIMIT 10
      ` as any[];

      healthCheck.services.database = {
        status: 'healthy',
        responseTime: `${dbResponseTime}ms`,
        info: dbInfo[0] || {},
        tableStats: tableCounts,
        connectionPool: {
          // Prisma connection pool info
          activeConnections: 'unknown', // Prisma doesn't expose this directly
          maxConnections: 'unknown'
        }
      };
      
      console.log('✅ [HEALTH CHECK] Database connection successful');
    } catch (error) {
      console.error('❌ [HEALTH CHECK] Database connection failed:', error);
      healthCheck.services.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      healthCheck.status = 'degraded';
    }

    // 2. Environment Variables Check
    try {
      console.log('🔍 [HEALTH CHECK] Checking environment variables...');
      
      const requiredEnvVars = [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_REGION',
        'AWS_S3_BUCKET_NAME'
      ];
      
      const envStatus = requiredEnvVars.map(envVar => ({
        name: envVar,
        present: !!process.env[envVar],
        value: process.env[envVar] ? '***hidden***' : 'missing'
      }));

      healthCheck.services.environment = {
        status: envStatus.every(env => env.present) ? 'healthy' : 'unhealthy',
        variables: envStatus
      };
      
      console.log('✅ [HEALTH CHECK] Environment variables checked');
    } catch (error) {
      console.error('❌ [HEALTH CHECK] Environment check failed:', error);
      healthCheck.services.environment = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 3. AWS S3 Check
    try {
      console.log('🔍 [HEALTH CHECK] Testing AWS S3 connection...');
      
      // Test S3 by trying to generate a presigned URL
      const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      });

      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: 'health-check-test.txt'
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
      
      healthCheck.services.aws_s3 = {
        status: 'healthy',
        bucket: process.env.AWS_S3_BUCKET_NAME,
        region: process.env.AWS_REGION,
        presignedUrlTest: 'successful'
      };
      
      console.log('✅ [HEALTH CHECK] AWS S3 connection successful');
    } catch (error) {
      console.error('❌ [HEALTH CHECK] AWS S3 connection failed:', error);
      healthCheck.services.aws_s3 = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      healthCheck.status = 'degraded';
    }

    // 4. Memory Usage
    try {
      console.log('🔍 [HEALTH CHECK] Checking memory usage...');
      
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const freeMem = totalMem - usedMem;
      const memUsagePercent = (usedMem / totalMem) * 100;

      healthCheck.services.memory = {
        status: memUsagePercent < 90 ? 'healthy' : 'warning',
        usage: {
          total: `${Math.round(totalMem / 1024 / 1024)}MB`,
          used: `${Math.round(usedMem / 1024 / 1024)}MB`,
          free: `${Math.round(freeMem / 1024 / 1024)}MB`,
          percentage: `${Math.round(memUsagePercent)}%`
        }
      };
      
      console.log('✅ [HEALTH CHECK] Memory usage checked');
    } catch (error) {
      console.error('❌ [HEALTH CHECK] Memory check failed:', error);
      healthCheck.services.memory = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 5. Recent Escrutinios Count
    try {
      console.log('🔍 [HEALTH CHECK] Checking recent escrutinios...');
      
      const recentCounts = await prisma.escrutinio.groupBy({
        by: ['electionLevel', 'status'],
        _count: {
          id: true
        },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      const totalEscrutinios = await prisma.escrutinio.count();
      const totalPapeletas = await prisma.papeleta.count();
      const totalVotes = await prisma.vote.count();

      healthCheck.services.data = {
        status: 'healthy',
        recentEscrutinios: recentCounts,
        totals: {
          escrutinios: totalEscrutinios,
          papeletas: totalPapeletas,
          votes: totalVotes
        }
      };
      
      console.log('✅ [HEALTH CHECK] Data statistics checked');
    } catch (error) {
      console.error('❌ [HEALTH CHECK] Data check failed:', error);
      healthCheck.services.data = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // 6. System Info
    try {
      console.log('🔍 [HEALTH CHECK] Gathering system info...');
      
      healthCheck.services.system = {
        status: 'healthy',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: `${Math.round(process.uptime())}s`,
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development'
      };
      
      console.log('✅ [HEALTH CHECK] System info gathered');
    } catch (error) {
      console.error('❌ [HEALTH CHECK] System info failed:', error);
      healthCheck.services.system = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Determine overall status
    const serviceStatuses = Object.values(healthCheck.services).map((service: any) => service.status);
    if (serviceStatuses.includes('unhealthy')) {
      healthCheck.status = 'unhealthy';
    } else if (serviceStatuses.includes('warning')) {
      healthCheck.status = 'warning';
    }

    console.log('🔍 [HEALTH CHECK] Health check completed:', healthCheck.status);

    return NextResponse.json({
      success: true,
      message: 'Health check completed',
      data: healthCheck
    });

  } catch (error) {
    console.error('🔍 [HEALTH CHECK] Health check failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Health check failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
