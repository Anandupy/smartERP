export interface FieldChange {
  field: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * The severities an audit entry can carry.
 *
 * Declared as a const tuple rather than only a union so the same list can be
 * the type *and* the Swagger `enum` — the values were previously visible to
 * TypeScript alone, which left `severity` documented as an open string and a
 * client with no way to build a filter for it.
 */
export const AUDIT_SEVERITIES = ['INFO', 'WARN', 'ERROR', 'CRITICAL'] as const;

export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

/** The outcomes an audit entry can record. */
export const AUDIT_STATUSES = ['SUCCESS', 'FAILURE'] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export interface CreateAuditLogInput {
  id?: string;
  timestamp?: Date;
  eventName: string;
  action: string;
  module: string;
  aggregateType: string;
  aggregateId: string;
  userId?: string | null;
  userEmail?: string | null;
  role?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  academicYearId?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  httpMethod?: string | null;
  route?: string | null;
  executionTime?: number | null;
  severity?: AuditSeverity;
  status?: AuditStatus;
  metadata?: Record<string, any> | null;
  changes?: FieldChange[] | Record<string, any> | null;
}
