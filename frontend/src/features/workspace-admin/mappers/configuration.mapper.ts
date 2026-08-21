import { UNSET, type ConfigurationFormValues } from "../schemas/configuration.schema";
import type {
  ClientPreferences,
  NavigationPreferences,
  UpsertWorkspaceConfigurationRequest,
  WorkspaceConfigurationDto,
  WorkspaceScopeType,
} from "../types/configuration.dto";

function triState(value: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function triStateFromBoolean(value: boolean | undefined): typeof UNSET | "true" | "false" {
  if (value === true) return "true";
  if (value === false) return "false";
  return UNSET;
}

/**
 * Build the request body from the tri-state form.
 *
 * Every `UNSET`/empty field is dropped rather than sent as `false`/`""` —
 * the whole point of the tri-state controls (see `schemas/configuration.schema`)
 * is that an untouched key must not overwrite whatever the shallow merge on the
 * backend is holding for it. A preference object with no keys set is omitted
 * entirely rather than sent as `{}`, since an empty object still counts as "I
 * intended to send this layer" to a reader of the request, and this save may
 * be touching only the other blob.
 */
export function toConfigurationRequest(
  values: ConfigurationFormValues,
): UpsertWorkspaceConfigurationRequest {
  const navigationPreferences: NavigationPreferences = {};
  const sidebarCollapsed = triState(values.sidebarCollapsed);
  if (sidebarCollapsed !== undefined) {
    navigationPreferences.sidebarCollapsed = sidebarCollapsed;
  }
  if (values.themeMode) navigationPreferences.themeMode = values.themeMode;
  if (values.defaultRoute) navigationPreferences.defaultRoute = values.defaultRoute;
  const denseMode = triState(values.denseMode);
  if (denseMode !== undefined) navigationPreferences.denseMode = denseMode;

  const clientPreferences: ClientPreferences = {};
  if (values.theme) clientPreferences.theme = values.theme;
  if (values.locale) clientPreferences.locale = values.locale;

  return {
    scopeType: values.scopeType,
    scopeId: values.scopeType === "PRODUCT" ? null : values.scopeId,
    navigationPreferences:
      Object.keys(navigationPreferences).length > 0
        ? navigationPreferences
        : undefined,
    clientPreferences:
      Object.keys(clientPreferences).length > 0 ? clientPreferences : undefined,
  };
}

/**
 * A fetched layer (or `null`, when none exists yet for this scope) → the
 * editor's tri-state form values.
 *
 * A field the stored layer never set becomes `UNSET`/`""` — "leave
 * unchanged" — exactly like an untouched field on a brand-new form, so
 * re-saving without editing that field still leaves it alone under the
 * shallow merge. `scopeType`/`scopeId` come from the caller's current
 * selection, not the fetched row, since this also runs for the "no layer
 * yet" (`null`) case where there is nothing to read them from.
 */
export function toConfigurationFormValues(
  scopeType: WorkspaceScopeType,
  scopeId: string,
  config: WorkspaceConfigurationDto | null,
): ConfigurationFormValues {
  const navigationPreferences = config?.navigationPreferences ?? {};
  const clientPreferences = config?.clientPreferences ?? {};

  return {
    scopeType,
    scopeId,
    sidebarCollapsed: triStateFromBoolean(navigationPreferences.sidebarCollapsed),
    themeMode: navigationPreferences.themeMode ?? "",
    defaultRoute: navigationPreferences.defaultRoute ?? "",
    denseMode: triStateFromBoolean(navigationPreferences.denseMode),
    theme: clientPreferences.theme ?? "",
    locale: clientPreferences.locale ?? "",
  };
}

export { UNSET };
