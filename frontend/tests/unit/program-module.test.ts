import { describe, expect, it } from "vitest";

import {
  buildProgramTree,
  childrenOf,
  deleteBlockedReason,
  eligibleParents,
  findDuplicateProgram,
  formatProgramClassification,
  programFormDefaults,
  programState,
  readProgramTree,
  toProgramFormValues,
  toProgramRequest,
} from "@/features/program";

import {
  childProgramDto,
  programDto,
  secondProgramDto,
} from "@tests/fixtures/program";

describe("program mapper", () => {
  it("sends exactly the six documented request fields", () => {
    const body = toProgramRequest(programFormDefaults("branch-1"));

    expect(Object.keys(body).sort()).toEqual([
      "branchId",
      "level",
      "medium",
      "name",
      "parentId",
      "stream",
    ]);
  });

  it("never sends isActive", () => {
    // It is implied by the status toggle endpoint and is in neither body.
    const body = toProgramRequest(programFormDefaults("branch-1"));
    expect(body).not.toHaveProperty("isActive");
  });

  it("sends blank optionals as null, not empty strings", () => {
    // `medium` and `stream` are part of documented uniqueness rule 1, so an
    // empty string and null are not interchangeable to the server.
    const body = toProgramRequest({
      branchId: "branch-1",
      name: "Primary",
      level: "",
      medium: "  ",
      stream: "",
      parentId: "NONE",
    });

    expect(body.level).toBeNull();
    expect(body.medium).toBeNull();
    expect(body.stream).toBeNull();
    expect(body.parentId).toBeNull();
  });

  it("round-trips a loaded program back into form values", () => {
    expect(toProgramFormValues(programDto())).toEqual({
      branchId: "branch-1",
      name: "Higher Secondary Science",
      level: "SCHOOL",
      medium: "English",
      stream: "Science (PCM)",
      parentId: "NONE",
    });
  });

  it("keeps a real parent through the round trip", () => {
    const values = toProgramFormValues(childProgramDto());
    expect(values.parentId).toBe("program-1");
    expect(toProgramRequest(values).parentId).toBe("program-1");
  });

  it("formats the classification the documentation's examples lead with", () => {
    expect(formatProgramClassification(programDto())).toBe(
      "English · Science (PCM)",
    );
    expect(
      formatProgramClassification(
        programDto({ medium: null, stream: null }),
      ),
    ).toBeNull();
  });
});

describe("program state", () => {
  it("reports an unreported flag as unknown, never inactive", () => {
    // No response body is documented, and the status toggle flips rather than
    // sets — so a wrong default makes the toggle unsafe as well as wrong.
    expect(programState(programDto({ isActive: undefined }))).toBe("unknown");
    expect(programState(programDto({ isActive: false }))).toBe("inactive");
    expect(programState(programDto({ isActive: true }))).toBe("active");
  });
});

describe("findDuplicateProgram — documented rule 1", () => {
  const existing = [programDto(), secondProgramDto()];

  it("matches on name, medium and stream together", () => {
    const clash = findDuplicateProgram(existing, {
      name: "Higher Secondary Science",
      medium: "English",
      stream: "Science (PCM)",
    });

    expect(clash?.id).toBe("program-1");
  });

  it("allows the same name with a different stream", () => {
    expect(
      findDuplicateProgram(existing, {
        name: "Higher Secondary Science",
        medium: "English",
        stream: "Science (PCB)",
      }),
    ).toBeNull();
  });

  it("compares case-insensitively and trims", () => {
    // "Primary " and "primary" colliding on the server while looking distinct
    // in the UI is the confusing outcome.
    const clash = findDuplicateProgram(existing, {
      name: "  higher secondary science ",
      medium: "ENGLISH",
      stream: "science (pcm)",
    });

    expect(clash?.id).toBe("program-1");
  });

  it("does not report a record as duplicating itself when editing", () => {
    expect(
      findDuplicateProgram(
        existing,
        {
          name: "Higher Secondary Science",
          medium: "English",
          stream: "Science (PCM)",
        },
        "program-1",
      ),
    ).toBeNull();
  });

  it("stays silent while the name is still empty", () => {
    expect(
      findDuplicateProgram(existing, { name: "", medium: "", stream: "" }),
    ).toBeNull();
  });
});

describe("program hierarchy", () => {
  const programs = [programDto(), secondProgramDto(), childProgramDto()];

  it("nests a child under its parent", () => {
    const { roots } = buildProgramTree(programs);

    expect(roots).toHaveLength(2);
    const parent = roots.find((node) => node.id === "program-1");
    expect(parent?.children.map((child) => child.id)).toEqual(["program-3"]);
  });

  it("orders siblings by name", () => {
    const { roots } = buildProgramTree(programs);
    expect(roots.map((node) => node.item.name)).toEqual([
      "Commerce",
      "Higher Secondary Science",
    ]);
  });

  it("lists direct children only", () => {
    expect(childrenOf(programs, "program-1").map((p) => p.id)).toEqual([
      "program-3",
    ]);
    expect(childrenOf(programs, "program-2")).toHaveLength(0);
  });

  describe("eligibleParents — documented rules 2 and 3", () => {
    it("offers everything when creating", () => {
      expect(eligibleParents(programs)).toHaveLength(3);
    });

    it("excludes the record itself", () => {
      const ids = eligibleParents(programs, "program-1").map((p) => p.id);
      expect(ids).not.toContain("program-1");
    });

    it("excludes the record's descendants, preventing a cycle", () => {
      const ids = eligibleParents(programs, "program-1").map((p) => p.id);
      expect(ids).toEqual(["program-2"]);
    });

    it("offers a sibling as a parent for a leaf", () => {
      const ids = eligibleParents(programs, "program-3").map((p) => p.id);
      expect(ids.sort()).toEqual(["program-1", "program-2"]);
    });
  });
});

describe("deleteBlockedReason — documented rule 4", () => {
  it("blocks a program with an active child and names it", () => {
    const programs = [programDto(), childProgramDto({ isActive: true })];
    const reason = deleteBlockedReason(programs, "program-1");

    expect(reason).toContain("Physics Elective");
    expect(reason).toContain("1 active child program");
  });

  it("allows deletion once the child is inactive", () => {
    const programs = [programDto(), childProgramDto({ isActive: false })];
    expect(deleteBlockedReason(programs, "program-1")).toBeNull();
  });

  it("does not block on a child whose flag was not reported", () => {
    // An absent flag is not evidence of an active child, and blocking on it
    // would make deletion impossible against a backend that omits the field.
    const programs = [programDto(), childProgramDto({ isActive: undefined })];
    expect(deleteBlockedReason(programs, "program-1")).toBeNull();
  });

  it("allows deletion of a leaf", () => {
    expect(deleteBlockedReason([programDto()], "program-1")).toBeNull();
  });

  it("summarises when more than three children block it", () => {
    const children = Array.from({ length: 5 }, (_, index) =>
      childProgramDto({ id: `child-${index}`, name: `Child ${index}` }),
    );
    const reason = deleteBlockedReason([programDto(), ...children], "program-1");

    expect(reason).toContain("5 active child programs");
    expect(reason).toContain("and 2 more");
  });
});

describe("readProgramTree — the undocumented tree response", () => {
  const nested = [
    { ...programDto(), children: [childProgramDto()] },
    secondProgramDto(),
  ];

  it("reads a bare array of roots", () => {
    const reading = readProgramTree(nested);

    expect(reading.isUnrecognized).toBe(false);
    expect(reading.programs.map((p) => p.id).sort()).toEqual([
      "program-1",
      "program-2",
      "program-3",
    ]);
  });

  it("reads the plausible wrapper shapes", () => {
    for (const key of ["data", "tree", "roots", "items"]) {
      const reading = readProgramTree({ [key]: nested });
      expect(reading.isUnrecognized).toBe(false);
      expect(reading.programs.length).toBe(3);
    }
  });

  it("derives parentId from the nesting when the node omits it", () => {
    // A tree endpoint is the one place where the structure is the answer.
    const reading = readProgramTree([
      { id: "p", name: "P", children: [{ id: "c", name: "C" }] },
    ]);

    expect(reading.programs.find((p) => p.id === "c")?.parentId).toBe("p");
  });

  it("reports an unrecognised payload rather than guessing", () => {
    expect(readProgramTree("nope").isUnrecognized).toBe(true);
    expect(readProgramTree(42).isUnrecognized).toBe(true);
    expect(readProgramTree({ unexpected: "shape" }).isUnrecognized).toBe(true);
  });

  it("treats an empty array as a legitimate answer, not an unreadable one", () => {
    const reading = readProgramTree([]);
    expect(reading.isUnrecognized).toBe(false);
    expect(reading.programs).toHaveLength(0);
  });

  it("reports a payload of unusable nodes as unrecognised", () => {
    expect(readProgramTree([{ nope: true }]).isUnrecognized).toBe(true);
  });

  it("terminates on a self-referential payload", () => {
    // Bounded depth: a malformed response must not hang the tab.
    const node: Record<string, unknown> = { id: "loop", name: "Loop" };
    node.children = [node];

    const reading = readProgramTree([node]);
    expect(reading.programs.length).toBeLessThanOrEqual(34);
  });
});
