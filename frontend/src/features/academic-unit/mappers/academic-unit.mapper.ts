import { isRecord } from "@/utils";

import { NO_PARENT } from "../constants";
import {
  academicUnitFormDefaults,
  type AcademicUnitFormValues,
} from "../schemas/academic-unit.schema";
import type {
  AcademicUnitDto,
  CreateAcademicUnitRequest,
} from "../types/academic-unit.dto";

/**
 * The only translation between the academic-unit form and the wire.
 *
 * The conventions the other modules follow, plus one this module introduces:
 *
 * - **Empty means `null`, not `""`.** Every documented optional the form leaves
 *   blank is sent as `null`, so clearing a field clears it.
 * - **The body is always complete.** The Postman update request sends all ten
 *   fields and no partial-update rule is documented.
 * - **`level` is never sent.** The documentation is explicit that it is
 *   auto-calculated and must not be updated manually, and it appears in no
 *   request body.
 *
 * `metadata` round-trips through a JSON text area rather than a structured
 * editor, because the documentation names example *uses* ("room capacities,
 * minimum students, lab requirements, custom shift timings") and no keys. A
 * form built around invented keys would be a schema this module made up.
 */

/** `""` → `null` for the documented optional strings. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Metadata as editable text.
 *
 * Pretty-printed on read so a nested object is legible in a textarea; an absent
 * or empty object becomes an empty box rather than `{}`, so a user who never
 * touches the field sends `null` rather than an empty object.
 */
export function toMetadataText(
  metadata: Record<string, unknown> | null | undefined,
): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "";
  }
}

/**
 * Metadata text back to an object.
 *
 * Returns `null` for blank or unparseable input. Unparseable cannot reach here
 * in practice — the schema rejects it first — but the parse is still guarded,
 * because a throw in a mapper would surface as a crashed form rather than as a
 * field error.
 */
export function fromMetadataText(
  value: string,
): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Seed the form from a loaded unit. */
export function toAcademicUnitFormValues(
  unit: AcademicUnitDto,
): AcademicUnitFormValues {
  return {
    ...academicUnitFormDefaults({
      branchId: unit.branchId,
      academicYearId: unit.academicYearId,
      programId: unit.programId,
    }),
    name: unit.name,
    code: unit.code ?? "",
    unitType: unit.unitType ?? "",
    displayOrder:
      typeof unit.displayOrder === "number" ? String(unit.displayOrder) : "",
    // An unreported flag seeds the form as active rather than inactive: no
    // response body is documented, and saving a form that silently deactivated
    // a live unit because a flag was missing is the worse failure.
    isActive: unit.isActive !== false,
    parentId: unit.parentId ?? NO_PARENT,
    metadata: toMetadataText(unit.metadata),
  };
}

/**
 * Form values → the complete documented request body.
 *
 * Used for both create and update: Postman defines the two bodies identically.
 */
export function toAcademicUnitRequest(
  values: AcademicUnitFormValues,
): CreateAcademicUnitRequest {
  return {
    branchId: values.branchId,
    programId: values.programId,
    academicYearId: values.academicYearId,
    parentId: values.parentId === NO_PARENT ? null : values.parentId,
    name: values.name.trim(),
    code: optional(values.code),
    unitType: optional(values.unitType),
    displayOrder:
      values.displayOrder.trim().length > 0
        ? Number(values.displayOrder)
        : null,
    isActive: values.isActive,
    metadata: fromMetadataText(values.metadata),
  };
}

/**
 * The unit's identity line: its type and code, where it has them.
 *
 * The type is shown verbatim rather than mapped through a lookup — the
 * documentation calls it a UI tag and warns against hardcoding logic for
 * particular values, so a value this module has never seen still displays.
 */
export function formatUnitIdentity(unit: AcademicUnitDto): string | null {
  const parts = [unit.unitType, unit.code]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : null;
}
