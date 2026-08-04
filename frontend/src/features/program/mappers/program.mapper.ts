import { NO_PARENT } from "../constants";
import {
  programFormDefaults,
  type ProgramFormValues,
} from "../schemas/program.schema";
import type { CreateProgramRequest, ProgramDto } from "../types/program.dto";

/**
 * The only translation between the program form and the wire.
 *
 * The same two conventions the other modules follow:
 *
 * - **Empty means `null`, not `""`.** Every documented optional the form leaves
 *   blank is sent as `null`, so clearing a field clears it rather than storing
 *   an empty string — which would also change the outcome of documented
 *   uniqueness rule 1, where `medium` and `stream` are part of the key.
 * - **The body is always complete.** The Postman update request sends all six
 *   fields and no partial-update rule is documented, so an edit resends the
 *   whole record.
 *
 * `isActive` is never sent: it is implied by the status toggle endpoint and is
 * in neither request body.
 */

/** `""` → `null` for the documented optional strings. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Seed the form from a loaded program. */
export function toProgramFormValues(program: ProgramDto): ProgramFormValues {
  return {
    ...programFormDefaults(program.branchId),
    name: program.name,
    level: program.level ?? "",
    medium: program.medium ?? "",
    stream: program.stream ?? "",
    parentId: program.parentId ?? NO_PARENT,
  };
}

/**
 * Form values → the complete documented request body.
 *
 * Used for both create and update: Postman defines the two bodies identically.
 * Choosing "no parent" sends `null`, which is what makes a program top-level —
 * the hierarchy is documented as optional.
 */
export function toProgramRequest(
  values: ProgramFormValues,
): CreateProgramRequest {
  return {
    branchId: values.branchId,
    name: values.name.trim(),
    level: optional(values.level),
    medium: optional(values.medium),
    stream: optional(values.stream),
    parentId: values.parentId === NO_PARENT ? null : values.parentId,
  };
}

/**
 * The program's classification, as one readable line, or `null` when it
 * declares none.
 *
 * Medium and stream are the two fields the documentation's own examples lead
 * with — "Primary (Medium: English)", "Jr. College (Stream: Science)" — so they
 * read together beneath the name.
 */
export function formatProgramClassification(
  program: ProgramDto,
): string | null {
  const parts = [program.medium, program.stream]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : null;
}
