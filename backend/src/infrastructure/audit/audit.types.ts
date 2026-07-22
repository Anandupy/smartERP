export interface FieldChange {
  field: string;
  oldValue?: any;
  newValue?: any;
}

export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type AuditStatus = 'SUCCESS' | 'FAILURE';

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
