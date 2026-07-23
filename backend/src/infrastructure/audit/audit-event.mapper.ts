import { Injectable, Optional } from '@nestjs/common';
import { DomainEvent } from '@/common/events/domain-event.base';
import { RequestContext } from '@/common/logger/request-context.middleware';
import { RequestContextService } from '@/common/logger/request-context.service';
import { CreateAuditLogInput, FieldChange } from './audit.types';

@Injectable()
export class AuditEventMapper {
  constructor(
    @Optional() private readonly requestContextService?: RequestContextService,
  ) {}

  mapToAuditLog(
    event: DomainEvent,
    explicitContext?: RequestContext | null,
  ): CreateAuditLogInput {
    const context =
      explicitContext ||
      this.requestContextService?.getContext() ||
      event.metadata?.context ||
      null;

    const action = this.inferAction(event);
    const moduleName = this.inferModule(event);
    const changes = this.extractChanges(event);

    return {
      eventName: event.eventName,
      action,
      module: moduleName,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      timestamp: event.occurredAt,
      userId: context?.userId || (event as any).payload?.userId || null,
      userEmail: (context as any)?.userEmail || null,
      role: context?.role || null,
      organizationId: context?.organizationId || null,
      branchId: context?.branchId || null,
      academicYearId: context?.academicYearId || null,
      requestId: context?.requestId || null,
      traceId: (context as any)?.traceId || null,
      correlationId: (context as any)?.correlationId || context?.requestId || null,
      ipAddress: (context as any)?.ipAddress || null,
      userAgent: (context as any)?.userAgent || null,
      httpMethod: (context as any)?.httpMethod || null,
      route: (context as any)?.route || null,
      executionTime: (context as any)?.executionTime || null,
      severity: event.metadata?.severity || 'INFO',
      status: event.metadata?.status || 'SUCCESS',
      metadata: {
        ...(event.metadata || {}),
        payload: (event as any).payload || undefined,
      },
      changes,
    };
  }

  private inferAction(event: DomainEvent): string {
    if (event.metadata?.action) return event.metadata.action;

    const name = event.eventName.toLowerCase();
    if (name.includes('created') || name.includes('registered')) return 'CREATE';
    if (name.includes('updated') || name.includes('modified')) return 'UPDATE';
    if (name.includes('deleted') || name.includes('removed')) return 'DELETE';
    if (name.includes('logged_in') || name.includes('login')) return 'LOGIN';
    if (name.includes('logged_out') || name.includes('logout')) return 'LOGOUT';

    return 'EXECUTE';
  }

  private inferModule(event: DomainEvent): string {
    if (event.metadata?.module) return event.metadata.module;

    const agg = event.aggregateType.toUpperCase();
    if (
      agg.includes('STUDENT') ||
      agg.includes('APPLICANT') ||
      agg.includes('GUARDIAN') ||
      agg.includes('ENROLLMENT') ||
      agg.includes('NUMBERSEQUENCECONFIG')
    ) {
      return 'ADMISSIONS';
    }
    if (agg.includes('BRANCH') || agg.includes('ORGANIZATION')) return 'ORGANIZATION';
    if (agg.includes('USER') || agg.includes('AUTH')) return 'AUTH';
    if (agg.includes('ACADEMIC')) return 'ACADEMIC';

    return agg || 'SYSTEM';
  }

  private extractChanges(event: DomainEvent): FieldChange[] | null {
    if (event.metadata?.changes && Array.isArray(event.metadata.changes)) {
      return event.metadata.changes as FieldChange[];
    }
    return null;
  }
}
