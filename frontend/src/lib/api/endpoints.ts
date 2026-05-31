// ============================================================
// API Endpoints — All backend endpoint paths
// Use these constants everywhere — never inline endpoint strings.
// Base URL is injected by the Axios client from env.
// ============================================================

export const ENDPOINTS = {
  // ── Auth ──────────────────────────────────────────────────
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    sessions: '/auth/sessions',
    revokeSession: (id: string) => `/auth/sessions/${id}`,
    revokeAllSessions: '/auth/sessions',
    // NOTE: No forgot-password or reset-password endpoints exist yet
    // These will be added when the backend implements them (GAP-02)
  },

  // ── Organizations ─────────────────────────────────────────
  organizations: {
    list: '/organizations',
    create: '/organizations',
    detail: (id: string) => `/organizations/${id}`,
    update: (id: string) => `/organizations/${id}`,
    delete: (id: string) => `/organizations/${id}`,
  },

  // ── Branches ──────────────────────────────────────────────
  branches: {
    list: '/branches',
    create: '/branches',
    detail: (id: string) => `/branches/${id}`,
    byOrganization: (orgId: string) => `/branches/organization/${orgId}`,
    update: (id: string) => `/branches/${id}`,
    delete: (id: string) => `/branches/${id}`,
    toggleStatus: (id: string) => `/branches/${id}/status`,
  },

  // ── Academic Years ────────────────────────────────────────
  academicYears: {
    list: '/academic-years',
    create: '/academic-years',
    current: '/academic-years/current',
    detail: (id: string) => `/academic-years/${id}`,
    update: (id: string) => `/academic-years/${id}`,
    delete: (id: string) => `/academic-years/${id}`,
    activate: (id: string) => `/academic-years/${id}/activate`,
    select: (id: string) => `/academic-years/${id}/select`,
    lock: (id: string) => `/academic-years/${id}/lock`,
  },

  // ── Programs ──────────────────────────────────────────────
  programs: {
    list: '/programs',
    tree: '/programs/tree',
    create: '/programs',
    detail: (id: string) => `/programs/${id}`,
    update: (id: string) => `/programs/${id}`,
    delete: (id: string) => `/programs/${id}`,
    toggleStatus: (id: string) => `/programs/${id}/status`,
  },

  // ── Academic Units ────────────────────────────────────────
  academicUnits: {
    list: '/academic-units',
    tree: '/academic-units/tree',
    create: '/academic-units',
    detail: (id: string) => `/academic-units/${id}`,
    update: (id: string) => `/academic-units/${id}`,
    delete: (id: string) => `/academic-units/${id}`,
    move: (id: string) => `/academic-units/${id}/move`,
    toggleStatus: (id: string) => `/academic-units/${id}/status`,
  },

  // ── Users ─────────────────────────────────────────────────
  users: {
    create: '/users',
    detail: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    // NOTE: No GET /users/me endpoint confirmed yet (GAP-07)
    // No list endpoint confirmed yet
  },

  // ── System Settings ───────────────────────────────────────
  systemSettings: {
    get: '/system-settings',
    init: '/system-settings/init',
    update: '/system-settings',
  },

  // ── Admissions (endpoints TBD — backend controller not found) ──
  // NOTE: DO NOT USE — Backend controller not yet confirmed (GAP-03)
  // Will be populated when backend contracts are available.
  admissions: {
    // applicants: { list: '/admissions/applicants', ... }
  },

  // ── Audit (endpoints TBD — backend controller not found) ──
  // NOTE: DO NOT USE — Backend controller not yet confirmed (GAP-04)
  audit: {},
} as const;
