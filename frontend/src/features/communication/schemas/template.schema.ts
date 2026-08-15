import { z } from "zod";

import { nonEmptyString } from "@/schemas";

import {
  COMMUNICATION_CHANNELS,
  NOTIFICATION_CATEGORIES,
  TEMPLATE_STATUSES,
} from "../types/template.dto";

/**
 * Form schema for creating and editing a message template.
 *
 * Every field maps directly to one of the thirteen documented request
 * fields (`types/template.dto.ts`) except `variablesText`, which is this
 * form's editable stand-in for the wire's `string[]` — a comma-separated list,
 * translated by the mapper. `version`, `organizationId` and `branchId` are
 * deliberately absent: version is set by the mutation (1 on create, the
 * loaded value — or +1 for "Save as new version" — on edit) and scope comes
 * from the active workspace, never typed in. See `mappers/template.mapper.ts`.
 *
 * Body fields are validated only as optional strings, never required per
 * channel: the backend stores all three body fields for every channel record,
 * and the module doc's channel-aware guidance (which fields to *show*) is a UI
 * concern the form component handles, not a contract rule this schema should
 * invent.
 */
export const templateFormSchema = z.object({
  code: nonEmptyString,
  name: nonEmptyString,
  description: z.string().trim(),
  channel: z.enum(COMMUNICATION_CHANNELS, {
    message: "Choose a channel",
  }),
  category: z.enum(NOTIFICATION_CATEGORIES, {
    message: "Choose a category",
  }),
  subject: z.string().trim(),
  bodyHtml: z.string().trim(),
  bodyText: z.string().trim(),
  /** Comma-separated variable names, e.g. `userName, resetLink, minutes`. */
  variablesText: z.string().trim(),
  language: nonEmptyString,
  status: z.enum(TEMPLATE_STATUSES),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;

/** A blank template, defaulted to the documented sample's language and status. */
export function templateFormDefaults(
  overrides: Partial<TemplateFormValues> = {},
): TemplateFormValues {
  return {
    code: "",
    name: "",
    description: "",
    channel: "EMAIL",
    category: "SYSTEM",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    variablesText: "",
    language: "en",
    status: "DRAFT",
    ...overrides,
  };
}
