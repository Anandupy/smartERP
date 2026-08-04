import { isRecord } from "@/utils";

import type { ProgramDto } from "../types/program.dto";

/**
 * Narrow the undocumented `GET /programs/tree` response.
 *
 * The endpoint is documented by **name only** — one row in a table reading
 * "Get hierarchical tree", with no response body in Postman, no nesting key,
 * and no statement of whether it returns an array of roots or an object
 * wrapping one. Typing it as a guessed interface is exactly the mistake §28
 * forbids, so it arrives as `unknown` and is narrowed here.
 *
 * The reader accepts the shapes such an endpoint plausibly uses:
 *
 * 1. a bare array of roots, each with a `children` array,
 * 2. `{ data: [...] }`,
 * 3. `{ tree: [...] }`,
 * 4. `{ roots: [...] }` or `{ items: [...] }`.
 *
 * Anything else reports `isUnrecognized`, and the screen falls back to building
 * the hierarchy from the flat list — which needs only `parentId`, a field both
 * request bodies document. So a wrong guess degrades to a visible marker and a
 * working screen, never to a fabricated hierarchy.
 */

export interface ProgramTreeReading {
  /** Flattened nodes, or `[]` when the payload could not be read. */
  programs: ProgramDto[];
  /** True when the payload matched none of the plausible shapes. */
  isUnrecognized: boolean;
}

/** The keys a wrapper might use, in the order they are tried. */
const ARRAY_KEYS = ["data", "tree", "roots", "items", "children"] as const;

/** Whether a value carries enough to be a program node. */
function isProgramLike(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.id === "string";
}

/**
 * Walk a nested node, emitting it and its descendants flat.
 *
 * `parentId` is **derived from the nesting** rather than trusted from the node,
 * because a tree endpoint is the one place where the structure is the answer.
 * If the node also carries a `parentId` that agrees, nothing changes; if it
 * carries none, the hierarchy still survives the flattening.
 *
 * `depth` is bounded so a payload with a cycle cannot hang the tab. The
 * documented backend prevents circular parents; a malformed response is still
 * the frontend's problem to survive.
 */
function flatten(
  node: Record<string, unknown>,
  parentId: string | null,
  out: ProgramDto[],
  depth: number,
): void {
  if (depth > 32) return;

  const children = ARRAY_KEYS.map((key) => node[key]).find(Array.isArray);

  out.push({
    id: String(node.id),
    branchId: typeof node.branchId === "string" ? node.branchId : "",
    name: typeof node.name === "string" ? node.name : "",
    level: typeof node.level === "string" ? node.level : null,
    medium: typeof node.medium === "string" ? node.medium : null,
    stream: typeof node.stream === "string" ? node.stream : null,
    parentId:
      typeof node.parentId === "string" && node.parentId.length > 0
        ? node.parentId
        : parentId,
    isActive: typeof node.isActive === "boolean" ? node.isActive : null,
  });

  if (Array.isArray(children)) {
    for (const child of children) {
      if (isProgramLike(child)) {
        flatten(child, String(node.id), out, depth + 1);
      }
    }
  }
}

export function readProgramTree(payload: unknown): ProgramTreeReading {
  const roots: unknown[] | null = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? ((ARRAY_KEYS.map((key) => payload[key]).find(Array.isArray) as
          | unknown[]
          | undefined) ?? null)
      : null;

  if (!roots) {
    return { programs: [], isUnrecognized: true };
  }

  // An empty array is a legitimate answer — a branch with no programs — and
  // must not be reported as unreadable.
  const programs: ProgramDto[] = [];
  for (const root of roots) {
    if (isProgramLike(root)) flatten(root, null, programs, 0);
  }

  if (roots.length > 0 && programs.length === 0) {
    return { programs: [], isUnrecognized: true };
  }

  return { programs, isUnrecognized: false };
}
