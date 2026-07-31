import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";
import { compact, groupBy, pick } from "@/utils";
import { initials, truncate } from "@/utils/format";

describe("utils", () => {
  it("cn merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", "font-medium")).toBe(
      "text-sm font-medium",
    );
  });

  it("compact removes nullish values", () => {
    expect(compact({ a: 1, b: null, c: undefined, d: "x" })).toEqual({
      a: 1,
      d: "x",
    });
  });

  it("pick selects only requested keys", () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  it("groupBy groups items by derived key", () => {
    const result = groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? "even" : "odd"));
    expect(result).toEqual({ odd: [1, 3], even: [2, 4] });
  });

  it("initials and truncate format strings", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(truncate("hello world", 5)).toBe("hell…");
  });
});
