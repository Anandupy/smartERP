import { describe, expect, it } from "vitest";

import {
  academicUnitFormDefaults,
  academicUnitFormSchema,
  academicUnitState,
  buildAcademicUnitTree,
  childrenOf,
  deleteBlockedReason,
  eligibleParents,
  findDuplicateSibling,
  formatUnitIdentity,
  fromMetadataText,
  readAcademicUnitTree,
  resolveLevel,
  toAcademicUnitFormValues,
  toAcademicUnitRequest,
  toMetadataText,
} from "@/features/academic-unit";

import {
  academicUnitDto,
  childUnitDto,
  secondChildUnitDto,
} from "@tests/fixtures/academic-unit";

const baseValues = academicUnitFormDefaults({
  branchId: "branch-1",
  programId: "program-1",
  academicYearId: "ay-2026",
});

describe("academic unit mapper", () => {
  it("sends exactly the ten documented request fields", () => {
    const body = toAcademicUnitRequest({ ...baseValues, name: "Div A" });

    expect(Object.keys(body).sort()).toEqual([
      "academicYearId",
      "branchId",
      "code",
      "displayOrder",
      "isActive",
      "metadata",
      "name",
      "parentId",
      "programId",
      "unitType",
    ]);
  });

  it("never sends level", () => {
    // The documentation is explicit: auto-calculated, maintained across moves,
    // "Do not update manually". It is in no request body.
    const body = toAcademicUnitRequest({ ...baseValues, name: "Div A" });
    expect(body).not.toHaveProperty("level");
  });

  it("sends blank optionals as null", () => {
    const body = toAcademicUnitRequest({ ...baseValues, name: "Div A" });

    expect(body.code).toBeNull();
    expect(body.unitType).toBeNull();
    expect(body.displayOrder).toBeNull();
    expect(body.parentId).toBeNull();
    expect(body.metadata).toBeNull();
  });

  it("sends displayOrder as a number when set", () => {
    const body = toAcademicUnitRequest({
      ...baseValues,
      name: "Div A",
      displayOrder: "3",
    });

    expect(body.displayOrder).toBe(3);
  });

  it("round-trips a loaded unit back into form values", () => {
    const values = toAcademicUnitFormValues(childUnitDto());

    expect(values.name).toBe("Div A");
    expect(values.parentId).toBe("unit-1");
    expect(values.displayOrder).toBe("1");
    expect(values.isActive).toBe(true);
  });

  it("seeds an unreported active flag as active, not inactive", () => {
    // No response body is documented. Saving a form that silently deactivated a
    // live unit because a flag was missing is the worse failure.
    const values = toAcademicUnitFormValues(
      academicUnitDto({ isActive: undefined }),
    );
    expect(values.isActive).toBe(true);
  });

  it("shows the unit type verbatim, including values it has never seen", () => {
    // The doc warns against hardcoding logic for a particular level, so an
    // unfamiliar type must still display.
    expect(
      formatUnitIdentity(academicUnitDto({ unitType: "HOUSE", code: "H1" })),
    ).toBe("HOUSE · H1");
    expect(
      formatUnitIdentity(academicUnitDto({ unitType: null, code: null })),
    ).toBeNull();
  });

  describe("metadata round trip", () => {
    it("pretty-prints an object for editing", () => {
      expect(toMetadataText({ roomCapacity: 40 })).toContain("roomCapacity");
    });

    it("renders an absent or empty object as a blank box", () => {
      // So a user who never touches the field sends null, not `{}`.
      expect(toMetadataText(null)).toBe("");
      expect(toMetadataText({})).toBe("");
    });

    it("parses an object back", () => {
      expect(fromMetadataText('{"a":1}')).toEqual({ a: 1 });
    });

    it("returns null for blank, unparseable or non-object input", () => {
      expect(fromMetadataText("")).toBeNull();
      expect(fromMetadataText("not json")).toBeNull();
      expect(fromMetadataText("[1,2]")).toBeNull();
    });
  });
});

describe("academic unit schema", () => {
  const valid = { ...baseValues, name: "Div A" };

  it("accepts the documented sample", () => {
    expect(academicUnitFormSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts any unit type, because no value set is documented", () => {
    expect(
      academicUnitFormSchema.safeParse({ ...valid, unitType: "HOUSE" }).success,
    ).toBe(true);
  });

  it("rejects a non-numeric display order", () => {
    expect(
      academicUnitFormSchema.safeParse({ ...valid, displayOrder: "first" })
        .success,
    ).toBe(false);
  });

  it("allows a blank display order", () => {
    expect(
      academicUnitFormSchema.safeParse({ ...valid, displayOrder: "" }).success,
    ).toBe(true);
  });

  it("requires metadata to be a JSON object when present", () => {
    expect(
      academicUnitFormSchema.safeParse({ ...valid, metadata: '{"a":1}' })
        .success,
    ).toBe(true);
    expect(
      academicUnitFormSchema.safeParse({ ...valid, metadata: "[1]" }).success,
    ).toBe(false);
    expect(
      academicUnitFormSchema.safeParse({ ...valid, metadata: "{" }).success,
    ).toBe(false);
    expect(
      academicUnitFormSchema.safeParse({ ...valid, metadata: "" }).success,
    ).toBe(true);
  });

  it("requires the three scope ids", () => {
    expect(
      academicUnitFormSchema.safeParse({ ...valid, programId: "" }).success,
    ).toBe(false);
    expect(
      academicUnitFormSchema.safeParse({ ...valid, academicYearId: "" }).success,
    ).toBe(false);
  });
});

describe("findDuplicateSibling — documented uniqueness rule", () => {
  const units = [academicUnitDto(), childUnitDto(), secondChildUnitDto()];

  it("finds a sibling with the same name under the same parent", () => {
    const clash = findDuplicateSibling(units, {
      name: "Div A",
      parentId: "unit-1",
    });

    expect(clash?.id).toBe("unit-2");
  });

  it("allows the same name under a different parent", () => {
    // The rule is scoped to siblings, not to the whole tree.
    expect(
      findDuplicateSibling(units, { name: "Div A", parentId: null }),
    ).toBeNull();
  });

  it("compares case-insensitively and trims", () => {
    expect(
      findDuplicateSibling(units, { name: "  div a ", parentId: "unit-1" })?.id,
    ).toBe("unit-2");
  });

  it("does not report a record as duplicating itself when editing", () => {
    expect(
      findDuplicateSibling(units, { name: "Div A", parentId: "unit-1" }, "unit-2"),
    ).toBeNull();
  });
});

describe("academic unit hierarchy", () => {
  const units = [academicUnitDto(), childUnitDto(), secondChildUnitDto()];

  it("nests children under their parent", () => {
    const { roots } = buildAcademicUnitTree(units);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.children.map((c) => c.id)).toEqual(["unit-2", "unit-3"]);
  });

  it("orders siblings by the documented displayOrder", () => {
    const { roots } = buildAcademicUnitTree([
      academicUnitDto(),
      childUnitDto({ id: "b", name: "B", displayOrder: 2 }),
      childUnitDto({ id: "a", name: "A", displayOrder: 1 }),
    ]);

    expect(roots[0]?.children.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("sorts a unit with no displayOrder after those that have one", () => {
    // Treating an absent order as 0 would jump an unordered unit to the front
    // of a deliberately ordered list.
    const { roots } = buildAcademicUnitTree([
      academicUnitDto(),
      childUnitDto({ id: "none", name: "Zed", displayOrder: null }),
      childUnitDto({ id: "first", name: "Alpha", displayOrder: 5 }),
    ]);

    expect(roots[0]?.children.map((c) => c.id)).toEqual(["first", "none"]);
  });

  it("falls back to name when display orders match", () => {
    const { roots } = buildAcademicUnitTree([
      academicUnitDto(),
      childUnitDto({ id: "b", name: "Beta", displayOrder: 1 }),
      childUnitDto({ id: "a", name: "Alpha", displayOrder: 1 }),
    ]);

    expect(roots[0]?.children.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("lists direct children only", () => {
    expect(childrenOf(units, "unit-1").map((u) => u.id)).toEqual([
      "unit-2",
      "unit-3",
    ]);
  });

  describe("eligibleParents — consistency and tree rules", () => {
    it("offers only units in the same program", () => {
      const other = academicUnitDto({
        id: "other",
        programId: "program-9",
        name: "Other",
      });

      const ids = eligibleParents([...units, other], "program-1").map(
        (u) => u.id,
      );

      expect(ids).not.toContain("other");
      expect(ids).toHaveLength(3);
    });

    it("excludes the record and its descendants", () => {
      const ids = eligibleParents(units, "program-1", "unit-1").map((u) => u.id);
      expect(ids).toHaveLength(0);
    });

    it("offers a sibling as a parent for a leaf", () => {
      const ids = eligibleParents(units, "program-1", "unit-2").map((u) => u.id);
      expect(ids.sort()).toEqual(["unit-1", "unit-3"]);
    });
  });

  describe("resolveLevel", () => {
    it("prefers the server's own figure", () => {
      expect(resolveLevel(academicUnitDto({ level: 7 }), 2)).toBe(7);
    });

    it("falls back to the derived depth when the response omits it", () => {
      expect(resolveLevel(academicUnitDto({ level: undefined }), 2)).toBe(2);
    });
  });
});

describe("deleteBlockedReason — the documented engine rule", () => {
  it("blocks a parent with an active child and names it", () => {
    const units = [academicUnitDto(), childUnitDto({ isActive: true })];
    const reason = deleteBlockedReason(units, "unit-1");

    expect(reason).toContain("Div A");
    expect(reason).toContain("1 active child");
  });

  it("allows deletion once the child is inactive", () => {
    const units = [academicUnitDto(), childUnitDto({ isActive: false })];
    expect(deleteBlockedReason(units, "unit-1")).toBeNull();
  });

  it("does not block on a child whose flag was not reported", () => {
    const units = [academicUnitDto(), childUnitDto({ isActive: undefined })];
    expect(deleteBlockedReason(units, "unit-1")).toBeNull();
  });

  it("allows deletion of a leaf", () => {
    expect(deleteBlockedReason([childUnitDto()], "unit-2")).toBeNull();
  });
});

describe("academic unit state", () => {
  it("reports an unreported flag as unknown", () => {
    expect(academicUnitState(academicUnitDto({ isActive: undefined }))).toBe(
      "unknown",
    );
    expect(academicUnitState(academicUnitDto({ isActive: false }))).toBe(
      "inactive",
    );
  });
});

describe("readAcademicUnitTree — the undocumented tree response", () => {
  const nested = [
    { ...academicUnitDto(), children: [childUnitDto(), secondChildUnitDto()] },
  ];

  it("reads a bare array of roots", () => {
    const reading = readAcademicUnitTree(nested);

    expect(reading.isUnrecognized).toBe(false);
    expect(reading.units.map((u) => u.id).sort()).toEqual([
      "unit-1",
      "unit-2",
      "unit-3",
    ]);
  });

  it("reads the plausible wrapper shapes", () => {
    for (const key of ["data", "tree", "roots", "items"]) {
      expect(readAcademicUnitTree({ [key]: nested }).isUnrecognized).toBe(false);
    }
  });

  it("derives parentId and level from the nesting when omitted", () => {
    const reading = readAcademicUnitTree([
      { id: "p", name: "P", children: [{ id: "c", name: "C" }] },
    ]);

    const child = reading.units.find((u) => u.id === "c");
    expect(child?.parentId).toBe("p");
    expect(child?.level).toBe(1);
  });

  it("reports an unrecognised payload rather than guessing", () => {
    expect(readAcademicUnitTree("nope").isUnrecognized).toBe(true);
    expect(readAcademicUnitTree({ unexpected: 1 }).isUnrecognized).toBe(true);
  });

  it("treats an empty array as a legitimate answer", () => {
    const reading = readAcademicUnitTree([]);
    expect(reading.isUnrecognized).toBe(false);
    expect(reading.units).toHaveLength(0);
  });

  it("terminates on a self-referential payload", () => {
    const node: Record<string, unknown> = { id: "loop", name: "Loop" };
    node.children = [node];

    expect(readAcademicUnitTree([node]).units.length).toBeLessThanOrEqual(34);
  });
});
