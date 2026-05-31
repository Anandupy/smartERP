// ============================================================
// Query Key Factory — TanStack Query key definitions
//
// Rules:
//   1. All query keys live here — never inline them in hooks
//   2. Keys are hierarchical — invalidating a parent invalidates children
//   3. Keys include filter objects for cache differentiation
// ============================================================

export const queryKeys = {
  // ── Auth ──────────────────────────────────────────────────
  auth: {
    sessions: () => ['auth', 'sessions'] as const,
  },

  // ── System Settings ───────────────────────────────────────
  systemSettings: {
    all: () => ['system-settings'] as const,
    detail: () => ['system-settings', 'detail'] as const,
  },

  // ── Organizations ─────────────────────────────────────────
  organizations: {
    all: () => ['organizations'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['organizations', 'list', filters] as const,
    detail: (id: string) => ['organizations', 'detail', id] as const,
  },

  // ── Branches ──────────────────────────────────────────────
  branches: {
    all: () => ['branches'] as const,
    list: (filters?: { orgId?: string; [key: string]: unknown }) =>
      ['branches', 'list', filters] as const,
    byOrganization: (orgId: string) =>
      ['branches', 'by-org', orgId] as const,
    detail: (id: string) => ['branches', 'detail', id] as const,
  },

  // ── Academic Years ────────────────────────────────────────
  academicYears: {
    all: () => ['academic-years'] as const,
    list: (branchId: string | null) =>
      ['academic-years', 'list', branchId] as const,
    current: (branchId: string | null) =>
      ['academic-years', 'current', branchId] as const,
    detail: (id: string) => ['academic-years', 'detail', id] as const,
  },

  // ── Programs ──────────────────────────────────────────────
  programs: {
    all: () => ['programs'] as const,
    list: (branchId: string | null, filters?: Record<string, unknown>) =>
      ['programs', 'list', branchId, filters] as const,
    tree: (branchId: string | null) =>
      ['programs', 'tree', branchId] as const,
    detail: (id: string) => ['programs', 'detail', id] as const,
  },

  // ── Academic Units ────────────────────────────────────────
  academicUnits: {
    all: () => ['academic-units'] as const,
    list: (
      branchId: string | null,
      academicYearId: string | null,
      filters?: Record<string, unknown>,
    ) =>
      ['academic-units', 'list', branchId, academicYearId, filters] as const,
    tree: (branchId: string | null, academicYearId: string | null) =>
      ['academic-units', 'tree', branchId, academicYearId] as const,
    detail: (id: string) => ['academic-units', 'detail', id] as const,
  },

  // ── Users ─────────────────────────────────────────────────
  users: {
    all: () => ['users'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  // ── Admissions (placeholders — contracts TBD) ─────────────
  admissions: {
    all: () => ['admissions'] as const,
    list: (branchId: string | null, filters?: Record<string, unknown>) =>
      ['admissions', 'list', branchId, filters] as const,
    counts: (branchId: string | null) =>
      ['admissions', 'counts', branchId] as const,
    detail: (id: string) => ['admissions', 'detail', id] as const,
  },

  // ── Audit (placeholders — contracts TBD) ─────────────────
  audit: {
    all: () => ['audit'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['audit', 'list', filters] as const,
    detail: (id: string) => ['audit', 'detail', id] as const,
  },
} as const;
