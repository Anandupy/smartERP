import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateAuditLogInput } from './audit.types';

@Injectable()
export class AuditRepository {
  private readonly logger = new Logger(AuditRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async createAuditLog(data: CreateAuditLogInput) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          id: data.id,
          timestamp: data.timestamp,
          eventName: data.eventName,
          action: data.action,
          module: data.module,
          aggregateType: data.aggregateType,
          aggregateId: data.aggregateId,
          userId: data.userId,
          userEmail: data.userEmail,
          role: data.role,
          organizationId: data.organizationId,
          branchId: data.branchId,
          academicYearId: data.academicYearId,
          requestId: data.requestId,
          traceId: data.traceId,
          correlationId: data.correlationId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          httpMethod: data.httpMethod,
          route: data.route,
          executionTime: data.executionTime,
          severity: data.severity ?? 'INFO',
          status: data.status ?? 'SUCCESS',
          metadata: data.metadata ? (data.metadata as any) : undefined,
          changes: data.changes ? (data.changes as any) : undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist audit log for event "${data.eventName}" (Aggregate: ${data.aggregateType}/${data.aggregateId}):`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  async findAuditLogs(query: {
    module?: string;
    aggregateType?: string;
    aggregateId?: string;
    userId?: string;
    action?: string;
    limit?: number;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        module: query.module,
        aggregateType: query.aggregateType,
        aggregateId: query.aggregateId,
        userId: query.userId,
        action: query.action,
      },
      orderBy: { timestamp: 'desc' },
      take: query.limit || 50,
    });
  }
}
