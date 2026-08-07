import type {
  AuditLogDto,
  AuditLogPage,
} from "@/features/audit/types/audit.dto";

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

/**
 * A page of audit records **in the shape the endpoint actually returns**.
 *
 * `GET /audit-logs` nests its pagination inside `data` as `{ items, meta }`,
 * and names the page size `limit`. Mocking the platform's other convention —
 * a bare array plus `meta.pagination` — is what let a green suite coexist with
 * a table that rendered nothing, so page responses are built here rather than
 * hand-written per test.
 */
export function auditLogPage(
  items: AuditLogDto[] = [auditLogDto()],
  meta: Partial<AuditLogPage["meta"]> = {},
): AuditLogPage {
  const limit = meta.limit ?? 50;
  const total = meta.total ?? items.length;

  return {
    items,
    meta: {
      total,
      page: meta.page ?? 1,
      limit,
      totalPages: meta.totalPages ?? Math.max(1, Math.ceil(total / limit)),
    },
  };
}
