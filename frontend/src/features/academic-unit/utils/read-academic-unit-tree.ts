import { isRecord } from "@/utils";

import type { AcademicUnitDto } from "../types/academic-unit.dto";

/**
 * Narrow the undocumented `GET /academic-units/tree` response.
 *
 * The endpoint exists only as a Postman entry with an empty response body —
 * no nesting key, no envelope, no statement of whether it returns roots or a
 * wrapper. Typing it as a guessed interface is exactly the mistake §28 forbids,
 * so it arrives as `unknown` and is narrowed here.
 *
 * Accepts a bare array of roots, or a wrapper keyed by any of the plausible
 * names. Anything else reports `isUnrecognized`, and the screen falls back to
 * building the hierarchy from the flat list — which needs only `parentId`, a
 * documented request field. So a wrong guess degrades to a visible marker and a
 * working screen, never to a fabricated hierarchy.
 */

export interface AcademicUnitTreeReading {
  /** Flattened nodes, or `[]` when the payload could not be read. */
  units: AcademicUnitDto[];
  /** True when the payload matched none of the plausible shapes. */
  isUnrecognized: boolean;
}

/** The keys a wrapper might use, in the order they are tried. */
const ARRAY_KEYS = ["data", "tree", "roots", "items", "children"] as const;

/** Whether a value carries enough to be a unit node. */
function isUnitLike(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.id === "string";
}

/**
 * Walk a nested node, emitting it and its descendants flat.
 *
 * `parentId` is **derived from the nesting** rather than trusted from the node,
 * because a tree endpoint is the one place where the structure is the answer.
 * `level` is likewise taken from the walk when the node does not carry one —
 * the doc defines it as depth from the root, so the nesting already knows it.
 *
 * `depth` is bounded so a payload with a cycle cannot hang the tab. The
 * documented backend prevents circular references; a malformed response is
 * still the frontend's problem to survive.
 */
function flatten(
  node: Record<string, unknown>,
  parentId: string | null,
  depth: number,
  out: AcademicUnitDto[],
): void {
  if (depth > 32) return;

  const children = ARRAY_KEYS.map((key) => node[key]).find(Array.isArray);

  out.push({
    id: String(node.id),
    branchId: typeof node.branchId === "string" ? node.branchId : "",
    programId: typeof node.programId === "string" ? node.programId : "",
    academicYearId:
      typeof node.academicYearId === "string" ? node.academicYearId : "",
    parentId:
      typeof node.parentId === "string" && node.parentId.length > 0
        ? node.parentId
        : parentId,
    name: typeof node.name === "string" ? node.name : "",
    code: typeof node.code === "string" ? node.code : null,
    unitType: typeof node.unitType === "string" ? node.unitType : null,
    displayOrder:
      typeof node.displayOrder === "number" ? node.displayOrder : null,
    isActive: typeof node.isActive === "boolean" ? node.isActive : null,
    metadata: isRecord(node.metadata) ? node.metadata : null,
    level: typeof node.level === "number" ? node.level : depth,
  });

  if (Array.isArray(children)) {
    for (const child of children) {
      if (isUnitLike(child)) {
        flatten(child, String(node.id), depth + 1, out);
      }
    }
  }
}

export function readAcademicUnitTree(
  payload: unknown,
): AcademicUnitTreeReading {
  const roots: unknown[] | null = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? ((ARRAY_KEYS.map((key) => payload[key]).find(Array.isArray) as
          | unknown[]
          | undefined) ?? null)
      : null;

  if (!roots) {
    return { units: [], isUnrecognized: true };
  }

  // An empty array is a legitimate answer — a year with no units — and must not
  // be reported as unreadable.
  const units: AcademicUnitDto[] = [];
  for (const root of roots) {
    if (isUnitLike(root)) flatten(root, null, 0, units);
  }

  if (roots.length > 0 && units.length === 0) {
    return { units: [], isUnrecognized: true };
  }

  return { units, isUnrecognized: false };
}
