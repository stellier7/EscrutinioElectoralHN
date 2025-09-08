import { prisma } from './prisma';
import type { AuditLogAction, AuditLogEntry } from '@/types';

export class AuditLogger {
  static async log(
    action: AuditLogAction,
    description: string,
    userId?: string,
    metadata?: Record<string, any>,
    request?: Request
  ): Promise<void> {
    try {
      let ipAddress: string | undefined;
      let userAgent: string | undefined;

      if (request) {
        ipAddress = this.getClientIP(request);
        userAgent = request.headers.get('user-agent') || undefined;
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action,
          description,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  static async logLogin(
    userId: string,
    email: string,
    success: boolean,
    request?: Request
  ): Promise<void> {
    const action: AuditLogAction = 'LOGIN';
    const description = success 
      ? `User ${email} logged in successfully`
      : `Failed login attempt for ${email}`;
    
    const metadata = {
      email,
      success,
      timestamp: new Date().toISOString(),
    };

    await this.log(action, description, success ? userId : undefined, metadata, request);
  }

  static async logLogout(userId: string, email: string, request?: Request): Promise<void> {
    const action: AuditLogAction = 'LOGOUT';
    const description = `User ${email} logged out`;
    
    const metadata = {
      email,
      timestamp: new Date().toISOString(),
    };

    await this.log(action, description, userId, metadata, request);
  }

  static async logEscrutinioStart(
    userId: string,
    escrutinioId: string,
    mesaNumber: string,
    electionLevel: string,
    request?: Request
  ): Promise<void> {
    const action: AuditLogAction = 'START_ESCRUTINIO';
    const description = `Started escrutinio for mesa ${mesaNumber} (${electionLevel})`;
    
    const metadata = {
      escrutinioId,
      mesaNumber,
      electionLevel,
      timestamp: new Date().toISOString(),
    };

    await this.log(action, description, userId, metadata, request);
  }

  static async logResultsSubmission(
    userId: string,
    escrutinioId: string,
    votesData: any[],
    request?: Request
  ): Promise<void> {
    const action: AuditLogAction = 'SUBMIT_RESULTS';
    const description = `Submitted voting results for escrutinio ${escrutinioId}`;
    
    const metadata = {
      escrutinioId,
      totalCandidates: votesData.length,
      totalVotes: votesData.reduce((sum, vote) => sum + (vote.count || 0), 0),
      timestamp: new Date().toISOString(),
    };

    await this.log(action, description, userId, metadata, request);
  }

  static async logEvidenceUpload(
    userId: string,
    escrutinioId: string,
    filename: string,
    fileSize: number,
    request?: Request
  ): Promise<void> {
    const action: AuditLogAction = 'UPLOAD_EVIDENCE';
    const description = `Uploaded evidence file ${filename} for escrutinio ${escrutinioId}`;
    
    const metadata = {
      escrutinioId,
      filename,
      fileSize,
      timestamp: new Date().toISOString(),
    };

    await this.log(action, description, userId, metadata, request);
  }

  static async logCorrection(
    userId: string,
    escrutinioId: string,
    candidateId: string,
    oldValue: number,
    newValue: number,
    reason?: string,
    request?: Request
  ): Promise<void> {
    const action: AuditLogAction = 'CORRECTION';
    const description = `Made correction for candidate ${candidateId}: ${oldValue} → ${newValue}`;
    
    const metadata = {
      escrutinioId,
      candidateId,
      oldValue,
      newValue,
      reason,
      timestamp: new Date().toISOString(),
    };

    await this.log(action, description, userId, metadata, request);
  }

  static async logTransmission(
    userId: string,
    escrutinioId: string,
    status: 'SUCCESS' | 'FAILED',
    error?: string,
    request?: Request
  ): Promise<void> {
    const action: AuditLogAction = 'TRANSMISSION';
    const description = status === 'SUCCESS'
      ? `Successfully transmitted data for escrutinio ${escrutinioId}`
      : `Failed to transmit data for escrutinio ${escrutinioId}`;
    
    const metadata = {
      escrutinioId,
      status,
      error,
      timestamp: new Date().toISOString(),
    };

    await this.log(action, description, userId, metadata, request);
  }

  static async logResultsView(
    userId?: string,
    electionLevel?: string,
    request?: Request
  ): Promise<void> {
    const action: AuditLogAction = 'VIEW_RESULTS';
    const description = electionLevel 
      ? `Viewed ${electionLevel} results`
      : 'Viewed election results';
    
    const metadata = {
      electionLevel,
      isPublicView: !userId,
      timestamp: new Date().toISOString(),
    };

    await this.log(action, description, userId, metadata, request);
  }

  static async getAuditLogs(
    filters?: {
      userId?: string;
      action?: AuditLogAction;
      dateFrom?: Date;
      dateTo?: Date;
    },
    pagination?: {
      page: number;
      limit: number;
    }
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const where: any = {};
    
    if (filters?.userId) {
      where.userId = filters.userId;
    }
    
    if (filters?.action) {
      where.action = filters.action;
    }
    
    if (filters?.dateFrom || filters?.dateTo) {
      where.timestamp = {};
      if (filters.dateFrom) {
        where.timestamp.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.timestamp.lte = filters.dateTo;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: pagination ? (pagination.page - 1) * pagination.limit : 0,
        take: pagination?.limit || 100,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const formattedLogs: AuditLogEntry[] = logs.map((log: any) => ({
      id: log.id,
      userId: log.userId || undefined,
      userName: log.user?.name || undefined,
      action: log.action,
      description: log.description,
      metadata: log.metadata ? JSON.parse(log.metadata as string) : undefined,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      timestamp: log.timestamp.toISOString(),
    }));

    return { logs: formattedLogs, total };
  }

  private static getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const remoteAddr = request.headers.get('remote-addr');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return realIP || remoteAddr || 'unknown';
  }
} 