import type { ThemeDefinition } from "./types";

/**
 * Registry of available themes. Ships with a single built-in "base" theme that
 * maps to the CSS variables already defined in `app/globals.css`. Workspace or
 * backend-provided themes register here at runtime without any code changes to
 * consumers — see `workspace-theme-adapter.ts`.
 */
class ThemeRegistry {
  private themes = new Map<string, ThemeDefinition>();
  private defaultId: string | null = null;

  register(theme: ThemeDefinition, options?: { makeDefault?: boolean }): this {
    this.themes.set(theme.id, theme);
    if (options?.makeDefault || this.defaultId === null) {
      this.defaultId = theme.id;
    }
    return this;
  }

  unregister(id: string): this {
    this.themes.delete(id);
    if (this.defaultId === id) {
      this.defaultId = this.themes.keys().next().value ?? null;
    }
    return this;
  }

  get(id: string): ThemeDefinition | undefined {
    return this.themes.get(id);
  }

  list(): ThemeDefinition[] {
    return Array.from(this.themes.values());
  }

  getDefault(): ThemeDefinition | undefined {
    return this.defaultId ? this.themes.get(this.defaultId) : undefined;
  }
}

export const themeRegistry = new ThemeRegistry();

/**
 * The built-in theme. Token values are intentionally left as an empty object:
 * the source of truth today is the CSS variables in `globals.css`. This entry
 * exists so the registry is never empty and the abstraction is exercised.
 */
export const baseTheme: ThemeDefinition = {
  id: "base",
  name: "CampusFlow Base",
  supportedModes: ["light", "dark"],
  tokens: {},
};

themeRegistry.register(baseTheme, { makeDefault: true });
