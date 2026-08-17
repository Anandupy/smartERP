import { UNSET, type ConfigurationFormValues } from "../schemas/configuration.schema";
import type {
  ClientPreferences,
  NavigationPreferences,
  UpsertWorkspaceConfigurationRequest,
} from "../types/configuration.dto";

function triState(value: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
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

export { UNSET };
