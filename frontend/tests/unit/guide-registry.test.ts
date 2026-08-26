import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GuideDefinition } from "@/core/guides";
import {
  __resetGuideRegistryForTests,
  getAllGuides,
  getGuide,
  getGuidesForRoute,
  registerGuide,
} from "@/core/guides/registry";

function definition(overrides: Partial<GuideDefinition> = {}): GuideDefinition {
  return {
    id: "academic-years",
    version: 1,
    title: "Academic Years",
    description: "Create and activate an academic year.",
    entryRoutes: ["/app/academic-years"],
    steps: [],
    ...overrides,
  };
}

beforeEach(() => {
  __resetGuideRegistryForTests();
});

describe("registerGuide / getGuide", () => {
  it("registers a guide and returns it by id", () => {
    registerGuide(definition());
    expect(getGuide("academic-years")?.title).toBe("Academic Years");
  });

  it("returns undefined for an id that was never registered", () => {
    expect(getGuide("does-not-exist")).toBeUndefined();
  });

  it("ignores a duplicate registration rather than throwing or overwriting", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    registerGuide(definition({ title: "First" }));
    expect(() =>
      registerGuide(definition({ title: "Second" })),
    ).not.toThrow();

    expect(getGuide("academic-years")?.title).toBe("First");
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe("getAllGuides", () => {
  it("lists every registered guide", () => {
    registerGuide(definition({ id: "academic-years" }));
    registerGuide(
      definition({ id: "branches", entryRoutes: ["/app/branches"] }),
    );

    expect(getAllGuides().map((guide) => guide.id).sort()).toEqual([
      "academic-years",
      "branches",
    ]);
  });
});

describe("getGuidesForRoute", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns guides whose entryRoutes include the pathname", () => {
    registerGuide(definition({ entryRoutes: ["/app/academic-years"] }));

    expect(getGuidesForRoute("/app/academic-years")).toHaveLength(1);
    expect(getGuidesForRoute("/app/branches")).toHaveLength(0);
  });
});
