/**
 * Canonical names for the custom request headers the platform will attach.
 * Values are populated at runtime by configurable header providers in the core
 * API layer — this file only fixes the wire names so client and backend agree.
 */
export const REQUEST_HEADERS = Object.freeze({
  authorization: "Authorization",
  requestId: "X-Request-Id",
  tenant: "X-Tenant-Id",
  branch: "X-Branch-Id",
  academicYear: "X-Academic-Year",
  workspace: "X-Workspace-Id",
});

export type RequestHeaderName =
  (typeof REQUEST_HEADERS)[keyof typeof REQUEST_HEADERS];
