import type {
  GeneralSettingsFormValues,
  InitSettingsFormValues,
  MaintenanceSupportFormValues,
} from "../schemas/system-settings.schema";
import type {
  InitSystemSettingsRequest,
  SystemSettingsDto,
  UpdateSystemSettingsRequest,
} from "../types/system-settings.dto";

/**
 * The only translation between the settings form shapes and the wire shape.
 *
 * Two things make a mapper necessary here rather than binding forms straight
 * to the DTO:
 *
 * 1. **The screens split the record, the endpoint does not.** General Settings
 *    and Maintenance & Support each edit part of one resource, but the backend
 *    documents no partial update — so every write reconstructs the *complete*
 *    documented body from the settings that were loaded plus the edits made.
 *    That is why each `to…Request` takes `current` as well as `values`.
 *
 * 2. **An empty optional is `null`, not `""`.** `maintenanceMessage` is the one
 *    documented optional field; a textarea cleared by the user means "no
 *    message", and sending an empty string instead would store one.
 */

/** Empty user input for an optional string becomes `null` on the wire. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Seed the General Settings form from the loaded record. */
export function toGeneralFormValues(
  settings: SystemSettingsDto,
): GeneralSettingsFormValues {
  return {
    productName: settings.productName,
    productCode: settings.productCode,
    version: settings.version,
    environment: settings.environment,
  };
}

/** Seed the Maintenance & Support form from the loaded record. */
export function toMaintenanceFormValues(
  settings: SystemSettingsDto,
): MaintenanceSupportFormValues {
  return {
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage ?? "",
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
  };
}

/** General Settings edits, merged into a complete update body. */
export function toGeneralUpdateRequest(
  current: SystemSettingsDto,
  values: GeneralSettingsFormValues,
): UpdateSystemSettingsRequest {
  return {
    productName: values.productName,
    productCode: values.productCode,
    version: values.version,
    environment: values.environment,
    maintenanceMode: current.maintenanceMode,
    maintenanceMessage: current.maintenanceMessage ?? null,
    supportEmail: current.supportEmail,
    supportPhone: current.supportPhone,
  };
}

/** Maintenance & Support edits, merged into a complete update body. */
export function toMaintenanceUpdateRequest(
  current: SystemSettingsDto,
  values: MaintenanceSupportFormValues,
): UpdateSystemSettingsRequest {
  return {
    productName: current.productName,
    productCode: current.productCode,
    version: current.version,
    environment: current.environment,
    maintenanceMode: values.maintenanceMode,
    maintenanceMessage: optional(values.maintenanceMessage),
    supportEmail: values.supportEmail,
    supportPhone: values.supportPhone,
  };
}

/** The initialization form, which already covers every documented field. */
export function toInitRequest(
  values: InitSettingsFormValues,
): InitSystemSettingsRequest {
  return {
    productName: values.productName,
    productCode: values.productCode,
    version: values.version,
    environment: values.environment,
    maintenanceMode: values.maintenanceMode,
    maintenanceMessage: optional(values.maintenanceMessage),
    supportEmail: values.supportEmail,
    supportPhone: values.supportPhone,
  };
}
