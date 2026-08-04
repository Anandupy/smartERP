import { describe, expect, it } from "vitest";

import {
  ancestorPath,
  buildTree,
  collectDescendantIds,
  flattenTree,
} from "@/utils";

/**
 * The shared hierarchy helpers, tested on their own.
 *
 * These back both the Program and Academic Unit trees, so a bug here is a bug
 * in two modules. The interesting cases are the malformed ones: orphans and
 * cycles are the reason this is a shared utility rather than two inline
 * `reduce` calls.
 */

interface Node {
  id: string;
  parentId: string | null;
  name: string;
}

const accessors = {
  getId: (node: Node) => node.id,
  getParentId: (node: Node) => node.parentId,
};

/** root → a → a1, a2; root → b. */
const nodes: Node[] = [
  { id: "root", parentId: null, name: "Root" },
  { id: "a", parentId: "root", name: "A" },
  { id: "b", parentId: "root", name: "B" },
  { id: "a1", parentId: "a", name: "A1" },
  { id: "a2", parentId: "a", name: "A2" },
];

describe("buildTree", () => {
  it("nests children under their parent", () => {
    const { roots } = buildTree(nodes, accessors);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe("root");
    expect(roots[0]?.children.map((child) => child.id)).toEqual(["a", "b"]);
  });

  it("stamps depth from the structure, never from the item", () => {
    const { roots } = buildTree(nodes, accessors);
    const a = roots[0]?.children[0];

    expect(roots[0]?.depth).toBe(0);
    expect(a?.depth).toBe(1);
    expect(a?.children[0]?.depth).toBe(2);
  });

  it("treats null, undefined and empty string alike as roots", () => {
    const { roots } = buildTree(
      [
        { id: "x", parentId: null, name: "X" },
        { id: "y", parentId: undefined as unknown as null, name: "Y" },
        { id: "z", parentId: "", name: "Z" },
      ],
      accessors,
    );

    expect(roots.map((node) => node.id)).toEqual(["x", "y", "z"]);
  });

  it("returns orphans separately rather than dropping them", () => {
    // A node whose parent is not in the list is a real possibility: these list
    // endpoints document soft deletes without documenting a flag for them.
    const { roots, orphans } = buildTree(
      [...nodes, { id: "lost", parentId: "gone", name: "Lost" }],
      accessors,
    );

    expect(orphans.map((node) => node.id)).toEqual(["lost"]);
    expect(roots).toHaveLength(1);
  });

  it("does not promote an orphan to a root", () => {
    // Showing a node at the top level of a hierarchy it does not belong to is
    // more misleading than listing it separately as unattached.
    const { roots } = buildTree(
      [{ id: "lost", parentId: "gone", name: "Lost" }],
      accessors,
    );

    expect(roots).toHaveLength(0);
  });

  it("rejects a self-parenting node instead of looping", () => {
    const { cyclic } = buildTree(
      [{ id: "self", parentId: "self", name: "Self" }],
      accessors,
    );

    expect(cyclic.map((node) => node.id)).toEqual(["self"]);
  });

  it("rejects a two-node cycle and still terminates", () => {
    // The documented backends prevent circular parents; a frontend that
    // recurses over a malformed payload does not render wrongly, it hangs.
    const { cyclic, roots } = buildTree(
      [
        { id: "p", parentId: "q", name: "P" },
        { id: "q", parentId: "p", name: "Q" },
      ],
      accessors,
    );

    expect(cyclic.length).toBeGreaterThan(0);
    expect(roots).toHaveLength(0);
  });

  it("orders siblings with the supplied comparator, at every level", () => {
    const { roots } = buildTree(nodes, {
      ...accessors,
      compare: (a, b) => b.name.localeCompare(a.name),
    });

    expect(roots[0]?.children.map((child) => child.id)).toEqual(["b", "a"]);
    expect(
      roots[0]?.children[1]?.children.map((child) => child.id),
    ).toEqual(["a2", "a1"]);
  });

  it("preserves input order when no comparator is given", () => {
    const { roots } = buildTree(nodes, accessors);
    expect(roots[0]?.children.map((child) => child.id)).toEqual(["a", "b"]);
  });

  it("handles an empty list", () => {
    const result = buildTree([], accessors);
    expect(result.roots).toHaveLength(0);
    expect(result.orphans).toHaveLength(0);
    expect(result.cyclic).toHaveLength(0);
  });
});

describe("flattenTree", () => {
  it("emits rows in render order with a11y positions", () => {
    const { roots } = buildTree(nodes, accessors);
    const rows = flattenTree(roots);

    expect(rows.map((row) => row.id)).toEqual(["root", "a", "a1", "a2", "b"]);
    // `aria-level` is 1-based; depth is 0-based.
    expect(rows[1]?.level).toBe(2);
    expect(rows[1]?.position).toBe(1);
    expect(rows[1]?.setSize).toBe(2);
  });

  it("marks which rows have children", () => {
    const { roots } = buildTree(nodes, accessors);
    const rows = flattenTree(roots);

    expect(rows.find((row) => row.id === "a")?.hasChildren).toBe(true);
    expect(rows.find((row) => row.id === "a1")?.hasChildren).toBe(false);
  });

  it("hides the children of a collapsed node", () => {
    const { roots } = buildTree(nodes, accessors);
    const rows = flattenTree(roots, new Set(["root"]));

    expect(rows.map((row) => row.id)).toEqual(["root", "a", "b"]);
  });

  it("expands everything when passed null", () => {
    const { roots } = buildTree(nodes, accessors);
    expect(flattenTree(roots, null)).toHaveLength(5);
  });
});

describe("collectDescendantIds", () => {
  it("collects the whole subtree, excluding the node itself", () => {
    const descendants = collectDescendantIds(nodes, accessors, "a");
    expect([...descendants].sort()).toEqual(["a1", "a2"]);
  });

  it("reaches grandchildren", () => {
    const descendants = collectDescendantIds(nodes, accessors, "root");
    expect([...descendants].sort()).toEqual(["a", "a1", "a2", "b"]);
  });

  it("returns nothing for a leaf", () => {
    expect(collectDescendantIds(nodes, accessors, "a1").size).toBe(0);
  });

  it("terminates on a cyclic list", () => {
    const descendants = collectDescendantIds(
      [
        { id: "p", parentId: "q", name: "P" },
        { id: "q", parentId: "p", name: "Q" },
      ],
      accessors,
      "p",
    );

    expect(descendants.size).toBeLessThanOrEqual(2);
  });
});

describe("ancestorPath", () => {
  it("returns the chain from the root down, inclusive", () => {
    const path = ancestorPath(nodes, accessors, "a1");
    expect(path.map((node) => node.id)).toEqual(["root", "a", "a1"]);
  });

  it("returns just the node for a root", () => {
    expect(ancestorPath(nodes, accessors, "root").map((n) => n.id)).toEqual([
      "root",
    ]);
  });

  it("returns nothing for an unknown id", () => {
    expect(ancestorPath(nodes, accessors, "nope")).toHaveLength(0);
  });

  it("stops at a missing ancestor rather than failing", () => {
    const path = ancestorPath(
      [{ id: "lost", parentId: "gone", name: "Lost" }],
      accessors,
      "lost",
    );

    expect(path.map((node) => node.id)).toEqual(["lost"]);
  });

  it("terminates on a cyclic chain", () => {
    const path = ancestorPath(
      [
        { id: "p", parentId: "q", name: "P" },
        { id: "q", parentId: "p", name: "Q" },
      ],
      accessors,
      "p",
    );

    expect(path.length).toBeLessThanOrEqual(2);
  });
});
