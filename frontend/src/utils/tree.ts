/**
 * Generic hierarchy helpers.
 *
 * Two ERP modules already hold a `parentId` tree — Programs and Academic Units
 * — and more will: the backend's navigation menus, fee categories, and any
 * chart of accounts. The logic for turning a flat list into a tree is identical
 * in every case and easy to get subtly wrong, so it lives here once, knows
 * nothing about any domain, and is unit-tested on its own.
 *
 * Two behaviours are the reason this is worth extracting rather than inlining:
 *
 * - **Orphans are returned, never dropped.** A node whose `parentId` points at
 *   something the list did not contain is a real possibility — these list
 *   endpoints document soft deletes without documenting a flag for them, and a
 *   caller may hold a filtered list. Silently discarding such a node loses data
 *   from a screen; returning it lets the UI say so.
 * - **Cycles are detected, not survived by luck.** Both backends document that
 *   they prevent circular parents, but a frontend that recurses over a
 *   malformed payload does not merely render wrongly — it hangs the tab. Every
 *   traversal here is bounded.
 */

/** The minimum this module needs to know about a node. */
export interface TreeAccessors<T> {
  getId: (item: T) => string;
  /** `null`/`undefined`/`""` all mean "this is a root". */
  getParentId: (item: T) => string | null | undefined;
  /** Orders siblings. Omit to preserve input order. */
  compare?: (a: T, b: T) => number;
}

/** One node, with its children resolved. */
export interface TreeNode<T> {
  id: string;
  item: T;
  /** 0 for a root, incremented per level. Computed, never read from the item. */
  depth: number;
  children: TreeNode<T>[];
}

export interface TreeResult<T> {
  roots: TreeNode<T>[];
  /**
   * Items whose `parentId` names a node that is not in the input.
   *
   * Deliberately **not** promoted to roots: a node showing up at the top level
   * of a hierarchy it does not belong to is a more misleading outcome than one
   * listed separately as unattached.
   */
  orphans: T[];
  /**
   * Items excluded because attaching them would close a loop.
   *
   * Empty against any payload the documented backends produce — both prevent
   * circular references — so a non-empty value means the data is malformed and
   * the UI should say so rather than quietly rendering a partial tree.
   */
  cyclic: T[];
}

/**
 * Turn a flat list into a tree.
 *
 * Single pass to index by id, then a second to attach. Parent resolution is by
 * lookup rather than by search, so this is linear rather than quadratic — which
 * matters for an academic-unit tree that can legitimately hold every section of
 * every class in a large school.
 */
export function buildTree<T>(
  items: readonly T[],
  accessors: TreeAccessors<T>,
): TreeResult<T> {
  const { getId, getParentId, compare } = accessors;

  const nodes = new Map<string, TreeNode<T>>();
  for (const item of items) {
    // A duplicate id would otherwise silently drop one of the two. Last wins,
    // matching how a `Map` behaves, and the tree stays well-formed.
    nodes.set(getId(item), { id: getId(item), item, depth: 0, children: [] });
  }

  const roots: TreeNode<T>[] = [];
  const orphans: T[] = [];
  const cyclic: T[] = [];

  for (const item of items) {
    const id = getId(item);
    const node = nodes.get(id);
    if (!node || node.item !== item) continue;

    const parentId = getParentId(item);
    if (!parentId) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(parentId);
    if (!parent) {
      orphans.push(item);
      continue;
    }

    if (parentId === id || wouldCycle(nodes, getParentId, getId, id, parentId)) {
      cyclic.push(item);
      continue;
    }

    parent.children.push(node);
  }

  if (compare) sortTree(roots, compare);
  assignDepth(roots, 0);

  return { roots, orphans, cyclic };
}

/**
 * Whether attaching `id` under `parentId` closes a loop.
 *
 * Walks up from the proposed parent looking for the node being attached. The
 * step counter is a hard stop: if the input already contains a cycle among
 * nodes processed earlier, the walk would otherwise never terminate.
 */
function wouldCycle<T>(
  nodes: Map<string, TreeNode<T>>,
  getParentId: (item: T) => string | null | undefined,
  getId: (item: T) => string,
  id: string,
  parentId: string,
): boolean {
  let cursor: string | null | undefined = parentId;
  let steps = 0;

  while (cursor && steps <= nodes.size) {
    if (cursor === id) return true;
    const next: TreeNode<T> | undefined = nodes.get(cursor);
    if (!next) return false;
    cursor = getParentId(next.item);
    if (cursor === getId(next.item)) return true;
    steps += 1;
  }

  return steps > nodes.size;
}

/** Order siblings at every level. */
function sortTree<T>(
  nodes: TreeNode<T>[],
  compare: (a: T, b: T) => number,
): void {
  nodes.sort((a, b) => compare(a.item, b.item));
  for (const node of nodes) sortTree(node.children, compare);
}

/** Stamp each node with its distance from a root. */
function assignDepth<T>(nodes: TreeNode<T>[], depth: number): void {
  for (const node of nodes) {
    node.depth = depth;
    assignDepth(node.children, depth + 1);
  }
}

/** A node flattened for rendering, with the state a tree row needs. */
export interface FlatTreeNode<T> {
  id: string;
  item: T;
  depth: number;
  hasChildren: boolean;
  /** 1-based, for `aria-level`. */
  level: number;
  /** Position among its siblings, 1-based, for `aria-posinset`. */
  position: number;
  /** How many siblings it has, for `aria-setsize`. */
  setSize: number;
}

/**
 * Flatten a tree into the visible rows, in render order.
 *
 * A flat list rather than nested markup because that is what a `role="tree"`
 * wants: rows carry `aria-level`/`aria-posinset`/`aria-setsize` and the DOM
 * stays shallow, which keeps keyboard navigation and virtualization possible.
 *
 * `expanded` is a set of ids whose children are shown. Passing `null` expands
 * everything, which is the right default for a small structural tree where
 * collapsing hides the thing the user came to see.
 */
export function flattenTree<T>(
  roots: readonly TreeNode<T>[],
  expanded: ReadonlySet<string> | null = null,
): FlatTreeNode<T>[] {
  const rows: FlatTreeNode<T>[] = [];

  const walk = (nodes: readonly TreeNode<T>[], depth: number) => {
    nodes.forEach((node, index) => {
      rows.push({
        id: node.id,
        item: node.item,
        depth,
        hasChildren: node.children.length > 0,
        level: depth + 1,
        position: index + 1,
        setSize: nodes.length,
      });

      const isExpanded = expanded === null || expanded.has(node.id);
      if (isExpanded && node.children.length > 0) {
        walk(node.children, depth + 1);
      }
    });
  };

  walk(roots, 0);
  return rows;
}

/**
 * Every id beneath `id`, not including it.
 *
 * The question a "move" control has to answer before it offers a destination:
 * a node cannot become its own descendant's child. Bounded by the node count,
 * so malformed input cannot hang the walk.
 */
export function collectDescendantIds<T>(
  items: readonly T[],
  accessors: Pick<TreeAccessors<T>, "getId" | "getParentId">,
  id: string,
): Set<string> {
  const { getId, getParentId } = accessors;

  const childrenByParent = new Map<string, string[]>();
  for (const item of items) {
    const parentId = getParentId(item);
    if (!parentId) continue;
    const bucket = childrenByParent.get(parentId);
    if (bucket) bucket.push(getId(item));
    else childrenByParent.set(parentId, [getId(item)]);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(id) ?? [])];

  while (queue.length > 0 && descendants.size <= items.length) {
    const next = queue.shift();
    if (!next || descendants.has(next)) continue;
    descendants.add(next);
    queue.push(...(childrenByParent.get(next) ?? []));
  }

  return descendants;
}

/**
 * The chain from a root down to `id`, root first, including the node itself.
 *
 * What a detail screen shows as "where this sits". Returns an empty array when
 * the id is not in the list, and stops rather than looping on malformed data.
 */
export function ancestorPath<T>(
  items: readonly T[],
  accessors: Pick<TreeAccessors<T>, "getId" | "getParentId">,
  id: string,
): T[] {
  const { getId, getParentId } = accessors;

  const byId = new Map<string, T>();
  for (const item of items) byId.set(getId(item), item);

  const path: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null | undefined = id;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const item: T | undefined = byId.get(cursor);
    if (!item) break;
    path.unshift(item);
    cursor = getParentId(item);
  }

  return path;
}
