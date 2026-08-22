import type { NumberingConfigFormValues } from "../schemas/numbering.schema";
import type {
  CreateNumberingConfigRequest,
  NumberingConfigDto,
  UpdateNumberingConfigRequest,
} from "../types/numbering.dto";

/** `""` → `null` for the optional `prefix`/`suffix` strings. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Seed the form from a loaded record. */
export function toNumberingConfigFormValues(
  config: NumberingConfigDto,
): NumberingConfigFormValues {
  return {
    purpose: config.purpose,
    prefix: config.prefix ?? "",
    suffix: config.suffix ?? "",
    includeBranchCode: config.includeBranchCode,
    includeAcademicYear: config.includeAcademicYear,
    sequencePadding: config.sequencePadding,
    format: config.format,
    isActive: config.isActive,
  };
}

/**
 * Form values → the documented Create body. `scope`, `allocationMode` and
 * `resetStrategy` are deliberately absent — server-derived from `purpose`,
 * not submitted (the Postman example's own description).
 */
export function toCreateNumberingConfigRequest(
  values: NumberingConfigFormValues,
): CreateNumberingConfigRequest {
  return {
    purpose: values.purpose,
    prefix: optional(values.prefix),
    suffix: optional(values.suffix),
    includeBranchCode: values.includeBranchCode,
    includeAcademicYear: values.includeAcademicYear,
    sequencePadding: values.sequencePadding,
    format: values.format,
  };
}

/** Form values → the documented Update body — `purpose` is not editable. */
export function toUpdateNumberingConfigRequest(
  values: NumberingConfigFormValues,
): UpdateNumberingConfigRequest {
  return {
    prefix: optional(values.prefix),
    suffix: optional(values.suffix),
    includeBranchCode: values.includeBranchCode,
    includeAcademicYear: values.includeAcademicYear,
    sequencePadding: values.sequencePadding,
    format: values.format,
    isActive: values.isActive,
  };
}
