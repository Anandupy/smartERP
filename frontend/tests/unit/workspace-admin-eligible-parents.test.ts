import { describe, expect, it } from "vitest";

import { MAX_MENU_DEPTH, eligibleParents } from "@/features/workspace-admin";

import {
  childMenuListItemDto,
  menuListItemDto,
} from "@tests/fixtures/workspace-admin";

describe("eligibleParents", () => {
  it("excludes the menu itself", () => {
    const menus = [menuListItemDto({ id: "a" }), menuListItemDto({ id: "b" })];
    const result = eligibleParents(menus, "a");
    expect(result.map((menu) => menu.id)).toEqual(["b"]);
  });

  it("excludes every descendant of the menu being edited — no cycles", () => {
    const root = menuListItemDto({ id: "root", parentId: null });
    const child = childMenuListItemDto({ id: "child", parentId: "root" });
    const grandchild = childMenuListItemDto({ id: "grandchild", parentId: "child" });

    const result = eligibleParents([root, child, grandchild], "root");

    expect(result.map((menu) => menu.id)).not.toContain("child");
    expect(result.map((menu) => menu.id)).not.toContain("grandchild");
  });

  it(`excludes a menu already at the deepest level, since a child would exceed depth ${MAX_MENU_DEPTH}`, () => {
    const root = menuListItemDto({ id: "root", parentId: null });
    const child = childMenuListItemDto({ id: "child", parentId: "root" });
    const grandchild = childMenuListItemDto({ id: "grandchild", parentId: "child" });
    const other = menuListItemDto({ id: "other", parentId: null });

    const result = eligibleParents([root, child, grandchild, other]);

    expect(result.map((menu) => menu.id).sort()).toEqual(["child", "other", "root"]);
    expect(result.map((menu) => menu.id)).not.toContain("grandchild");
  });
});
