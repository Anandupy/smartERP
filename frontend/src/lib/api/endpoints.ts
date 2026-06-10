// ============================================================
// Versioned API Endpoint Registry
//
// Architecture:
//   apiVersionBuilder(path) → prepends /v1 (configurable)
//   ENDPOINTS.*            → all typed endpoint paths
//
// Rules:
//   - NEVER inline endpoint strings outside this file
//   - Use ENDPOINTS.module.action pattern everywhere
//   - Dynamic segments use function signatures: (id: string) => string
//   - Version is controlled by NEXT_PUBLIC_API_VERSION env var
// ============================================================

/** Current API version prefix */
const API_VERSION = process.env['NEXT_PUBLIC_API_VERSION'] ?? 'v1';

/**
 * Prepends the API version prefix to a path.
 * @example apiVersionBuilder('/auth/login') → '/v1/auth/login'
 */
export function apiVersionBuilder(path: string): string {
  return `/${API_VERSION}${path}`;
}

const v = apiVersionBuilder; // shorthand

// ── Endpoint Registry ─────────────────────────────────────────

export const ENDPOINTS = {

  // ── Auth ────────────────────────────────────────────────────
  auth: {
    login:           v('/auth/login'),
    refresh:         v('/auth/refresh'),
    logout:          v('/auth/logout'),
    sessions:        v('/auth/sessions'),
    revokeSession:   (id: string) => v(`/auth/sessions/${id}`),
    revokeAllSessions: v('/auth/sessions'),
  },

  // ── Users ────────────────────────────────────────────────────
  users: {
    create: v('/users'),
    detail: (id: string) => v(`/users/${id}`),
    update: (id: string) => v(`/users/${id}`),
  },

  // ── System Settings ──────────────────────────────────────────
  systemSettings: {
    get:    v('/system-settings'),
    init:   v('/system-settings/init'),
    update: v('/system-settings'),
  },

  // ── Organizations ────────────────────────────────────────────
  organizations: {
    list:   v('/organizations'),
    create: v('/organizations'),
    detail: (id: string) => v(`/organizations/${id}`),
    update: (id: string) => v(`/organizations/${id}`),
    delete: (id: string) => v(`/organizations/${id}`),
  },

  // ── Branches ─────────────────────────────────────────────────
  branches: {
    list:            v('/branches'),
    create:          v('/branches'),
    detail:          (id: string) => v(`/branches/${id}`),
    byOrganization:  (orgId: string) => v(`/branches/organization/${orgId}`),
    update:          (id: string) => v(`/branches/${id}`),
    delete:          (id: string) => v(`/branches/${id}`),
    toggleStatus:    (id: string) => v(`/branches/${id}/status`),
  },

  // ── Academic Years ───────────────────────────────────────────
  academicYears: {
    list:    v('/academic-years'),
    create:  v('/academic-years'),
    current: v('/academic-years/current'),
    detail:  (id: string) => v(`/academic-years/${id}`),
    update:  (id: string) => v(`/academic-years/${id}`),
    delete:  (id: string) => v(`/academic-years/${id}`),
    activate: (id: string) => v(`/academic-years/${id}/activate`),
    select:   (id: string) => v(`/academic-years/${id}/select`),
    lock:     (id: string) => v(`/academic-years/${id}/lock`),
  },

  // ── Programs ─────────────────────────────────────────────────
  programs: {
    list:         v('/programs'),
    tree:         v('/programs/tree'),
    create:       v('/programs'),
    detail:       (id: string) => v(`/programs/${id}`),
    update:       (id: string) => v(`/programs/${id}`),
    delete:       (id: string) => v(`/programs/${id}`),
    toggleStatus: (id: string) => v(`/programs/${id}/status`),
  },

  // ── Academic Units ───────────────────────────────────────────
  academicUnits: {
    list:         v('/academic-units'),
    tree:         v('/academic-units/tree'),
    create:       v('/academic-units'),
    detail:       (id: string) => v(`/academic-units/${id}`),
    update:       (id: string) => v(`/academic-units/${id}`),
    delete:       (id: string) => v(`/academic-units/${id}`),
    move:         (id: string) => v(`/academic-units/${id}/move`),
    toggleStatus: (id: string) => v(`/academic-units/${id}/status`),
  },

  // ── Admissions — Masters ─────────────────────────────────────
  admissions: {
    masters: {
      // Generic helper: religions, castes, categories, genders, etc.
      list:   (slug: string) => v(`/admissions/masters/${slug}`),
      create: (slug: string) => v(`/admissions/masters/${slug}`),
      detail: (slug: string, id: string) => v(`/admissions/masters/${slug}/${id}`),
      update: (slug: string, id: string) => v(`/admissions/masters/${slug}/${id}`),
      delete: (slug: string, id: string) => v(`/admissions/masters/${slug}/${id}`),

      // Named slugs for type safety
      religions:        v('/admissions/masters/religions'),
      castes:           v('/admissions/masters/castes'),
      categories:       v('/admissions/masters/categories'),
      genders:          v('/admissions/masters/genders'),
      bloodGroups:      v('/admissions/masters/blood-groups'),
      languages:        v('/admissions/masters/languages'),
      disabilities:     v('/admissions/masters/disabilities'),
      relationTypes:    v('/admissions/masters/relation-types'),
      quotas:           v('/admissions/masters/quotas'),
      admissionSources: v('/admissions/masters/admission-sources'),
    },

    // ── Numbering ──────────────────────────────────────────────
    numbering: {
      configs: {
        list:   v('/admissions/numbering/configs'),
        create: v('/admissions/numbering/configs'),
      },
    },

    // ── Guardians ─────────────────────────────────────────────
    guardians: {
      create:   v('/admissions/guardians'),
      search:   v('/admissions/guardians/search'),
      detail:   (id: string) => v(`/admissions/guardians/${id}`),
      update:   (id: string) => v(`/admissions/guardians/${id}`),
      mapToApplicant:      (applicantId: string) => v(`/admissions/guardians/applicant/${applicantId}/map`),
      listForApplicant:    (applicantId: string) => v(`/admissions/guardians/applicant/${applicantId}`),
      unmapFromApplicant:  (applicantId: string, guardianId: string) =>
        v(`/admissions/guardians/applicant/${applicantId}/map/${guardianId}`),
    },

    // ── Applicants ────────────────────────────────────────────
    applicants: {
      list:             v('/admissions/applicants'),
      create:           v('/admissions/applicants'),
      checkDuplicates:  v('/admissions/applicants/check-duplicates'),
      detail:           (id: string) => v(`/admissions/applicants/${id}`),
      update:           (id: string) => v(`/admissions/applicants/${id}`),
      delete:           (id: string) => v(`/admissions/applicants/${id}`),

      // Workflow
      transition:       (id: string) => v(`/admissions/applicants/${id}/workflow/transition`),
      workflowHistory:  (id: string) => v(`/admissions/applicants/${id}/workflow/history`),

      // Enrollment
      createEnrollment: (id: string) => v(`/admissions/applicants/${id}/enrollment`),
      getEnrollment:    (id: string) => v(`/admissions/applicants/${id}/enrollment`),
    },
  },

} as const;
