import type { AuditLogDto } from "@/features/audit/types/audit.dto";

/**
 * Builder for an audit record.
 *
 * Only the columns documented in the `AuditLog` table are set by default. The
 * filterable-but-undocumented fields (`severity`, `status`, `executionTime`,
 * trace ids) are left out unless a test explicitly supplies them, so the
 * default fixture exercises the same "field may be absent" path the real
 * backend is expected to take.
 */
export function auditLogDto(overrides: Partial<AuditLogDto> = {}): AuditLogDto {
  return {
    id: "audit-1",
    timestamp: "2026-08-01T10:00:00.000Z",
    eventName: "system_settings.updated",
    action: "UPDATE",
    module: "SYSTEM",
    aggregateType: "SystemSettings",
    aggregateId: "settings-1",
    userId: "user-1",
    userEmail: "admin@institution.edu",
    role: "SUPER_ADMIN",
    organizationId: "org-1",
    branchId: null,
    academicYearId: null,
    requestId: "req-1",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
    ...overrides,
  };
}
