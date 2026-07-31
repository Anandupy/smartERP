import { themeRegistry } from "./theme-registry";
import type { DesignTokens, ThemeDefinition } from "./types";

/**
 * Future Workspace Theme Adapter (placeholder).
 *
 * When the backend exposes per-workspace branding, its payload is translated
 * into a {@link ThemeDefinition} here and registered with the theme registry.
 * The adapter is deliberately a pure, side-effect-light transform so it can be
 * unit-tested and swapped. It is NOT wired into the provider yet.
 */
export interface WorkspaceThemePayload {
  workspaceId: string;
  displayName: string;
  tokens: Partial<DesignTokens>;
  supportsDarkMode?: boolean;
}

export function adaptWorkspaceTheme(
  payload: WorkspaceThemePayload,
): ThemeDefinition {
  return {
    id: `workspace:${payload.workspaceId}`,
    name: payload.displayName,
    supportedModes: payload.supportsDarkMode ? ["light", "dark"] : ["light"],
    tokens: payload.tokens,
  };
}

/** Register (or replace) a workspace theme. Reserved for the workspace module. */
export function registerWorkspaceTheme(payload: WorkspaceThemePayload): void {
  themeRegistry.register(adaptWorkspaceTheme(payload));
}
