/**
 * Canonical names for the custom request headers the platform will attach.
 * Values are populated at runtime by configurable header providers in the core
 * API layer — this file only fixes the wire names so client and backend agree.
 *
 * The three scope headers are the names the backend documents
 * (`x-organization-id`, `x-branch-id`, `x-academic-year-id` — the OpenAPI
 * `@ApiHeader` declarations and `backend/docs/core/frontend-contract-answers.md`
 * §2). `X-Tenant-Id` and `X-Academic-Year`, sent until 2026-10-18, are only
 * accepted aliases. HTTP header names are case-insensitive.
 */
export const REQUEST_HEADERS = Object.freeze({
  authorization: "Authorization",
  requestId: "X-Request-Id",
  tenant: "X-Organization-Id",
  branch: "X-Branch-Id",
  academicYear: "X-Academic-Year-Id",
  workspace: "X-Workspace-Id",
});

export type RequestHeaderName =
  (typeof REQUEST_HEADERS)[keyof typeof REQUEST_HEADERS];
