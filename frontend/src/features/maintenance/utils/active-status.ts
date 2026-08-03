import type { MaintenanceScopeType } from "../types/maintenance.dto";

import { MAINTENANCE_SCOPE_TYPES } from "../types/maintenance.dto";

/**
 * What the app is willing to display from the active-status endpoint.
 *
 * Every field is optional because every field is a guess about a response the
 * backend has not documented.
 */
export interface ActiveMaintenanceStatus {
  isUnderMaintenance: boolean;
  title: string | null;
  message: string | null;
  scopeType: MaintenanceScopeType | null;
  customPage: string | null;
  /** True when the payload matched nothing this reader recognizes. */
  isUnrecognized: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * Read `GET /maintenance-rules/active/status` defensively.
 *
 * The endpoint's meaning is documented; its response body is not. Rather than
 * declare an interface and hope, this reader looks only for field names the
 * `MaintenanceRule` table already defines (`title`, `shortMessage`,
 * `scopeType`, `customPage`, `isActive`), accepts a bare `null` or `{}` as
 * "nothing is active", and reports `isUnrecognized` when a payload arrives that
 * it cannot read at all.
 *
 * The point is that a wrong guess degrades to showing nothing, never to
 * announcing a maintenance window that is not happening — or, worse, to
 * staying silent about one that is because a property was named differently.
 * Callers surface `isUnrecognized` as a `Backend Pending` note.
 */
export function readActiveStatus(payload: unknown): ActiveMaintenanceStatus {
  const empty: ActiveMaintenanceStatus = {
    isUnderMaintenance: false,
    title: null,
    message: null,
    scopeType: null,
    customPage: null,
    isUnrecognized: false,
  };

  if (payload === null || payload === undefined) {
    return empty;
  }

  // A bare boolean is the one non-object shape worth honouring: "is anything
  // under maintenance" is a plausible answer to this question.
  if (typeof payload === "boolean") {
    return { ...empty, isUnderMaintenance: payload };
  }

  const source = record(payload);
  if (!source) {
    return { ...empty, isUnrecognized: true };
  }

  if (Object.keys(source).length === 0) {
    return empty;
  }

  // The rule may arrive at the top level or nested under a wrapper key; both
  // are read the same way, and neither is assumed.
  const nested = record(source.rule) ?? record(source.maintenance) ?? source;

  const scopeTypeValue = nested.scopeType;
  const scopeType = MAINTENANCE_SCOPE_TYPES.includes(
    scopeTypeValue as MaintenanceScopeType,
  )
    ? (scopeTypeValue as MaintenanceScopeType)
    : null;

  const title = text(nested, "title");
  const message = text(nested, "shortMessage") ?? text(nested, "description");
  const customPage = text(nested, "customPage");

  // `isActive` is the rule's own documented flag; `isUnderMaintenance` and
  // `active` are the names a status endpoint would plausibly use. Any of them
  // being explicitly `true` counts, and so does simply having recognized a rule.
  const flags = [
    nested.isActive,
    source.isUnderMaintenance,
    source.underMaintenance,
    source.active,
  ];
  const flagged = flags.some((flag) => flag === true);
  const recognizedRule = Boolean(scopeType ?? title ?? message);

  if (!flagged && !recognizedRule) {
    // Something came back, and none of it is anything this reader knows.
    return {
      ...empty,
      isUnrecognized: flags.every((flag) => flag === undefined),
    };
  }

  return {
    isUnderMaintenance: true,
    title,
    message,
    scopeType,
    customPage,
    isUnrecognized: false,
  };
}
