import type { SystemSettingsDto } from "@/features/system-settings/types/system-settings.dto";

/**
 * Builder for the system settings record.
 *
 * Carries exactly the eight documented fields and nothing else — a fixture with
 * an extra `id` or `updatedAt` would let a test pass against a field the
 * backend never promised, which is the specific failure this milestone is
 * trying to avoid.
 */
export function systemSettingsDto(
  overrides: Partial<SystemSettingsDto> = {},
): SystemSettingsDto {
  return {
    productName: "CampusFlow ERP",
    productCode: "CF-ERP",
    version: "1.0.0",
    environment: "DEV",
    maintenanceMode: false,
    maintenanceMessage: null,
    supportEmail: "support@campusflow.io",
    supportPhone: "1800123456",
    ...overrides,
  };
}
