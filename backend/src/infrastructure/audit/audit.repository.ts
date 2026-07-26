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

  private buildWhereClause(user: any, query: any) {
    const where: any = {};

    // 1. RBAC Enforcements
    if (user.role === 'SUPER_ADMIN') {
      if (query.organizationId) where.organizationId = query.organizationId;
      if (query.branchId) where.branchId = query.branchId;
      if (query.userId) where.userId = query.userId;
    } else if (user.role === 'ORG_ADMIN') {
      where.organizationId = user.organizationId;
      if (query.branchId) where.branchId = query.branchId;
      if (query.userId) where.userId = query.userId;
    } else if (user.role === 'BRANCH_ADMIN') {
      where.branchId = user.branchId;
      if (query.userId) where.userId = query.userId;
    } else {
      // STAFF, STUDENT, PARENT
      where.userId = user.id;
    }

    // 2. Query Filters
    if (query.role) where.role = query.role;
    if (query.module) where.module = query.module;
    if (query.action) where.action = query.action;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (query.requestId) where.requestId = query.requestId;
    if (query.traceId) where.traceId = query.traceId;
    if (query.correlationId) where.correlationId = query.correlationId;

    if (query.httpMethod) {
      where.httpMethod = { equals: query.httpMethod, mode: 'insensitive' };
    }
    if (query.route) {
      where.route = { contains: query.route, mode: 'insensitive' };
    }
    if (query.eventName) {
      where.eventName = { contains: query.eventName, mode: 'insensitive' };
    }
    if (query.aggregateType) {
      where.aggregateType = query.aggregateType;
    }
    if (query.aggregateId) {
      where.aggregateId = query.aggregateId;
    }

    // Execution time filter
    if (
      query.minExecutionTime !== undefined ||
      query.maxExecutionTime !== undefined
    ) {
      where.executionTime = {};
      if (query.minExecutionTime !== undefined) {
        where.executionTime.gte = Number(query.minExecutionTime);
      }
      if (query.maxExecutionTime !== undefined) {
        where.executionTime.lte = Number(query.maxExecutionTime);
      }
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) where.timestamp.gte = new Date(query.startDate);
      if (query.endDate) where.timestamp.lte = new Date(query.endDate);
    }

    // Search filter
    if (query.search) {
      where.OR = [
        { eventName: { contains: query.search, mode: 'insensitive' } },
        { module: { contains: query.search, mode: 'insensitive' } },
        { aggregateType: { contains: query.search, mode: 'insensitive' } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { aggregateId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async queryAuditLogs(user: any, query: any) {
    const where = this.buildWhereClause(user, query);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;

    const allowedSortFields = [
      'timestamp',
      'severity',
      'module',
      'executionTime',
    ];
    const sortBy = allowedSortFields.includes(query.sortBy)
      ? query.sortBy
      : 'timestamp';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const includeDetails =
      query.includeDetails === true || query.includeDetails === 'true';

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          timestamp: true,
          eventName: true,
          action: true,
          module: true,
          aggregateType: true,
          aggregateId: true,
          userId: true,
          userEmail: true,
          role: true,
          organizationId: true,
          branchId: true,
          academicYearId: true,
          requestId: true,
          traceId: true,
          correlationId: true,
          ipAddress: true,
          userAgent: true,
          httpMethod: true,
          route: true,
          executionTime: true,
          severity: true,
          status: true,
          metadata: includeDetails,
          changes: includeDetails,
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAuditSummary(user: any, query: any) {
    const where = this.buildWhereClause(user, query);

    const [totalCount, byModule, byAction, bySeverity, byStatus] =
      await Promise.all([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.groupBy({
          by: ['module'],
          _count: { _all: true },
          where,
        }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          _count: { _all: true },
          where,
        }),
        this.prisma.auditLog.groupBy({
          by: ['severity'],
          _count: { _all: true },
          where,
        }),
        this.prisma.auditLog.groupBy({
          by: ['status'],
          _count: { _all: true },
          where,
        }),
      ]);

    return {
      totalCount,
      byModule: byModule.map((g) => ({
        module: g.module,
        count: g._count._all || (g._count as any),
      })),
      byAction: byAction.map((g) => ({
        action: g.action,
        count: g._count._all || (g._count as any),
      })),
      bySeverity: bySeverity.map((g) => ({
        severity: g.severity,
        count: g._count._all || (g._count as any),
      })),
      byStatus: byStatus.map((g) => ({
        status: g.status,
        count: g._count._all || (g._count as any),
      })),
    };
  }

  async getAuditTimeline(user: any, query: any) {
    const where = this.buildWhereClause(user, query);

    // Fetch timestamps to calculate daily activity
    const logsForTimeline = await this.prisma.auditLog.findMany({
      where,
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const dailyMap = new Map<string, number>();
    for (const log of logsForTimeline) {
      const dateStr = log.timestamp.toISOString().split('T')[0];
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
    }
    const dailyActivity = Array.from(dailyMap.entries()).map(
      ([date, count]) => ({
        date,
        count,
      }),
    );

    // Fetch recent events
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;

    const events = await this.prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        timestamp: true,
        eventName: true,
        action: true,
        module: true,
        aggregateType: true,
        aggregateId: true,
        userEmail: true,
        severity: true,
        status: true,
      },
    });

    return {
      dailyActivity,
      events,
    };
  }

  async getAuditLogById(user: any, id: string) {
    const log = await this.prisma.auditLog.findFirst({
      where: { id },
    });

    if (!log) {
      return null;
    }

    // Horizontal Privilege Escalation prevention
    if (user.role === 'SUPER_ADMIN') {
      return log;
    }

    if (user.role === 'ORG_ADMIN') {
      if (log.organizationId !== user.organizationId) {
        return 'FORBIDDEN';
      }
      return log;
    }

    if (user.role === 'BRANCH_ADMIN') {
      if (log.branchId !== user.branchId) {
        return 'FORBIDDEN';
      }
      return log;
    }

    // STAFF, STUDENT, PARENT
    if (log.userId !== user.id) {
      return 'FORBIDDEN';
    }

    return log;
  }
}
