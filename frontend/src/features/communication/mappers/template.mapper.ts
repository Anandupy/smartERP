import {
  templateFormDefaults,
  type TemplateFormValues,
} from "../schemas/template.schema";
import type { TemplateDto, TemplateWriteRequest } from "../types/template.dto";

/**
 * The only translation between the template form and the wire.
 *
 * - **Empty optional strings become `null`**, matching every other module's
 *   convention: clearing a field clears it rather than sending `""`.
 * - **`variables` is always sent as a `string[]`**, split from the form's
 *   comma-separated text — the documented create/update sample sends an
 *   array of names, so that is the shape written back regardless of what a
 *   loaded record's `variables` happened to be (see `toVariablesText` below
 *   for reading the other documented shapes back).
 */

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A loaded template's `variables` — `string[] | Record<string,unknown> | null`
 * — back into the form's comma-separated text.
 *
 * An object's *keys* become the editable names, since the form only edits
 * variable *names*, not sample values (sample values are the preview drawer's
 * job, against the real `POST /templates/preview` endpoint).
 */
export function toVariablesText(
  variables: TemplateDto["variables"],
): string {
  if (Array.isArray(variables)) return variables.join(", ");
  if (variables && typeof variables === "object") {
    return Object.keys(variables).join(", ");
  }
  return "";
}

/** Comma-separated text back to the documented `string[]`. */
export function fromVariablesText(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Seed the form from a loaded template. */
export function toTemplateFormValues(template: TemplateDto): TemplateFormValues {
  return {
    ...templateFormDefaults(),
    code: template.code ?? "",
    name: template.name ?? "",
    description: template.description ?? "",
    channel: template.channel ?? "EMAIL",
    category: template.category ?? "SYSTEM",
    subject: template.subject ?? "",
    bodyHtml: template.bodyHtml ?? "",
    bodyText: template.bodyText ?? "",
    variablesText: toVariablesText(template.variables),
    language: template.language ?? "en",
    status: template.status ?? "DRAFT",
  };
}

/**
 * Form values → the complete documented request body.
 *
 * `version`, `organizationId` and `branchId` are supplied by the caller
 * (the create/update hooks) rather than the form, per the module doc: version
 * is a mutation concern (1 on create; preserved, or incremented for "Save as
 * new version", on edit) and scope is always the active workspace's, never
 * typed in.
 */
export function toTemplateRequest(
  values: TemplateFormValues,
  scope: { version: number; organizationId: string | null; branchId: string | null },
): TemplateWriteRequest {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: optional(values.description),
    channel: values.channel,
    category: values.category,
    subject: optional(values.subject),
    bodyHtml: optional(values.bodyHtml),
    bodyText: optional(values.bodyText),
    variables: fromVariablesText(values.variablesText),
    language: values.language.trim(),
    version: scope.version,
    status: values.status,
    organizationId: scope.organizationId,
    branchId: scope.branchId,
  };
}

/**
 * A template's scope, in the three-level terms the doc describes: both ids
 * null is the global default, org set with branch null is tenant-wide, both
 * set is branch-specific.
 */
export type TemplateScopeLevel = "global" | "organization" | "branch";

export function templateScopeLevel(template: TemplateDto): TemplateScopeLevel {
  if (template.branchId) return "branch";
  if (template.organizationId) return "organization";
  return "global";
}

export const TEMPLATE_SCOPE_LABEL: Record<TemplateScopeLevel, string> = {
  global: "Global default",
  organization: "Organization-wide",
  branch: "Branch-specific",
};
