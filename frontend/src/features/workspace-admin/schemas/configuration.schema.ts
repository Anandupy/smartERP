import { z } from "zod";

import { WORKSPACE_SCOPE_TYPES } from "../types/configuration.dto";

/**
 * Form schema for the Configuration Layer Editor.
 *
 * Both preference blobs are schemaless JSON on the backend
 * (`navigationPreferences`/`clientPreferences` are typed `Record<string, any>`
 * in `workspace-config.dto.ts`) — the documented keys (`sidebarCollapsed`,
 * `themeMode`, `defaultRoute`, `denseMode`, `theme`, `locale`) are examples in
 * the Postman request body, not a contract. This module edits exactly those
 * six known keys through structured controls rather than a free-form JSON
 * editor, per the design brief: "validate known keys client-side and warn on
 * unknown ones" rather than accept arbitrary JSON.
 *
 * Every preference field is **tri-state, not boolean/string** — `UNSET` and
 * `""` both mean "leave this key alone." That matters because
 * `workspace-config.service.ts` **shallow-merges** the submitted object into
 * whatever already exists for the scope: sending `sidebarCollapsed: false`
 * writes `false`, but sending nothing for it leaves whatever was already
 * stored. A plain boolean control cannot represent "don't touch this," so an
 * edit to one field would silently overwrite every other key. The mapper
 * (`mappers/configuration.mapper.ts`) drops every `UNSET`/empty field before
 * building the request body.
 */
export const UNSET = "UNSET";
const TRI_STATE = [UNSET, "true", "false"] as const;

export const configurationFormSchema = z
  .object({
    scopeType: z.enum(WORKSPACE_SCOPE_TYPES),
    /** Ignored when `scopeType` is `PRODUCT`, which has no scope target. */
    scopeId: z.string().trim(),
    sidebarCollapsed: z.enum(TRI_STATE),
    themeMode: z.string(),
    defaultRoute: z.string().trim(),
    denseMode: z.enum(TRI_STATE),
    theme: z.string(),
    locale: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    if (values.scopeType !== "PRODUCT" && values.scopeId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["scopeId"],
        message: "Required for every scope except Product",
      });
    }
  });

export type ConfigurationFormValues = z.infer<typeof configurationFormSchema>;

export function configurationFormDefaults(): ConfigurationFormValues {
  return {
    scopeType: "USER",
    scopeId: "",
    sidebarCollapsed: UNSET,
    themeMode: "",
    defaultRoute: "",
    denseMode: UNSET,
    theme: "",
    locale: "",
  };
}
