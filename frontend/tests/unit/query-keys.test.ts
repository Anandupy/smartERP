import { describe, expect, it } from "vitest";

import { createQueryKeys } from "@/core/query";

describe("createQueryKeys", () => {
  const keys = createQueryKeys("students");

  it("builds stable, namespaced keys", () => {
    expect(keys.all).toEqual(["students"]);
    expect(keys.lists()).toEqual(["students", "list"]);
    expect(keys.detail("42")).toEqual(["students", "detail", "42"]);
  });

  it("includes filters in list keys when provided", () => {
    expect(keys.list({ page: 2 })).toEqual(["students", "list", { page: 2 }]);
    expect(keys.list()).toEqual(["students", "list"]);
  });
});
