// ============================================================
// Plugin Extension Registry
//
// Allows plugins to inject UI contributions without modifying
// core application code.
//
// Future plugins can call registerPlugin() to inject:
//   - sidebar nav sections
//   - routes
//   - widgets
//   - settings pages
//   - dashboard panels
// ============================================================

import type { LucideIcon } from 'lucide-react';

// ── Plugin Nav Types (mirrors NavSection/NavItem — defined here to avoid circular imports) ──

interface PluginNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
  badge?: string | number;
  isComingSoon?: boolean;
  pluginId?: string;
}

interface PluginNavSection {
  id: string;
  label?: string;
  items: PluginNavItem[];
  pluginId?: string;
}

// Alias for use in this file and public API
type NavSection = PluginNavSection;

// ── Plugin Manifest ───────────────────────────────────────────

export interface PluginContribution {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Sidebar navigation sections to inject */
  navSections?: NavSection[];
  /** Route paths this plugin provides (for future dynamic routing) */
  routes?: PluginRoute[];
  /** Widget IDs this plugin provides */
  widgetIds?: string[];
}

export interface PluginRoute {
  path: string;
  /** Component import path (resolved at plugin load time) */
  componentPath: string;
}

// ── Registry ─────────────────────────────────────────────────

const registeredPlugins: Map<string, PluginContribution> = new Map();

/**
 * Register a plugin's UI contributions.
 * Called by plugin initialization code at app startup.
 */
export function registerPlugin(contribution: PluginContribution): void {
  if (registeredPlugins.has(contribution.id)) {
    console.warn(`[EduOS Plugin] Plugin "${contribution.id}" is already registered.`);
    return;
  }
  registeredPlugins.set(contribution.id, contribution);
}

/**
 * Get all nav sections contributed by plugins,
 * filtered for the given role.
 * Returns sections compatible with NavSection in config/navigation.ts.
 */
export function getPluginNavSections(_role?: string): PluginNavSection[] {
  const sections: NavSection[] = [];
  for (const plugin of registeredPlugins.values()) {
    if (plugin.navSections) {
      sections.push(...plugin.navSections);
    }
  }
  return sections;
}

/**
 * Get all registered plugin routes.
 */
export function getPluginRoutes(): PluginRoute[] {
  const routes: PluginRoute[] = [];
  for (const plugin of registeredPlugins.values()) {
    if (plugin.routes) {
      routes.push(...plugin.routes);
    }
  }
  return routes;
}

/**
 * Get all registered plugins.
 */
export function getRegisteredPlugins(): PluginContribution[] {
  return Array.from(registeredPlugins.values());
}

/**
 * Clear all registered plugins (used in tests).
 */
export function clearPluginRegistry(): void {
  registeredPlugins.clear();
}
