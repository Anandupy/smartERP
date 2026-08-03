import { describe, expect, it } from "vitest";

import { ROUTES } from "@/constants";
// The module under test, not the feature barrel — see the note in
// `audit-analytics.test.ts`.
import {
  isNavItemActive,
  resolveBreadcrumbs,
} from "@/features/navigation/utils/breadcrumbs";

describe("resolveBreadcrumbs", () => {
  it("returns nothing outside the app", () => {
    expect(resolveBreadcrumbs("/login")).toEqual([]);
    expect(resolveBreadcrumbs("/workspace")).toEqual([]);
  });

  it("does not treat a path merely prefixed by /app as inside it", () => {
    expect(resolveBreadcrumbs("/application")).toEqual([]);
  });

  it("gives the app root a single, unlinked crumb", () => {
    expect(resolveBreadcrumbs(ROUTES.app.root)).toEqual([
      { label: "Dashboard" },
    ]);
  });

  it("builds one step per segment and links all but the last", () => {
    expect(resolveBreadcrumbs(ROUTES.app.settings.general)).toEqual([
      { label: "Dashboard", href: "/app" },
      { label: "System Settings", href: "/app/settings" },
      { label: "General" },
    ]);
  });

  it("prefers a registered label over the humanized slug", () => {
    const trail = resolveBreadcrumbs(ROUTES.app.settings.systemInformation);
    expect(trail.at(-1)).toEqual({ label: "System Information" });
  });

  it("humanizes unregistered segments, which is what makes record ids readable", () => {
    const trail = resolveBreadcrumbs("/app/maintenance/rule-7/edit");
    expect(trail.map((crumb) => crumb.label)).toEqual([
      "Dashboard",
      "Maintenance",
      "Rule 7",
      "Edit",
    ]);
  });

  it("never links the current page", () => {
    const trail = resolveBreadcrumbs(ROUTES.app.audit.root);
    expect(trail.at(-1)).not.toHaveProperty("href");
  });
});

describe("isNavItemActive", () => {
  const dashboard = { href: "/app", exact: true };
  const settings = { href: "/app/settings" };

  it("matches a section root against its descendants", () => {
    expect(isNavItemActive("/app/settings", settings)).toBe(true);
    expect(isNavItemActive("/app/settings/general", settings)).toBe(true);
  });

  it("does not match a sibling whose path merely shares a prefix", () => {
    expect(isNavItemActive("/app/settings-archive", settings)).toBe(false);
  });

  it("keeps the exact dashboard entry from matching every route beneath it", () => {
    expect(isNavItemActive("/app", dashboard)).toBe(true);
    expect(isNavItemActive("/app/audit", dashboard)).toBe(false);
  });
});
