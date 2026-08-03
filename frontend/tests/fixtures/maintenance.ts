import type { MaintenanceRuleDto } from "@/features/maintenance/types/maintenance.dto";

/**
 * Builder for a maintenance rule.
 *
 * Defaults mirror the documented backend defaults (`allowLogin` false,
 * `allowReadApis` true, `allowWriteApis` false) and the documented example
 * status, so a fixture with no overrides is a rule the backend would actually
 * have produced.
 */
export function maintenanceRuleDto(
  overrides: Partial<MaintenanceRuleDto> = {},
): MaintenanceRuleDto {
  return {
    id: "rule-1",
    scopeType: "GLOBAL",
    scopeId: null,
    isActive: true,
    allowLogin: false,
    allowReadApis: true,
    allowWriteApis: false,
    customStatus: 503,
    customPage: null,
    bypassRoles: ["DEVOPS"],
    startAt: null,
    endAt: null,
    timezone: "Asia/Kolkata",
    isRecurring: false,
    recurrenceDayOfWeek: null,
    recurrenceStartTime: null,
    recurrenceEndTime: null,
    title: "Scheduled system upgrade",
    shortMessage: "System is temporarily offline for upgrades.",
    ...overrides,
  };
}
