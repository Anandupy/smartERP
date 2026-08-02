import { describe, expect, it } from "vitest";

import type { WorkspaceOptions } from "@/core/workspace";
import { validateWorkspaceSelection } from "@/features/workspace";

const OPTIONS: WorkspaceOptions = {
  organizations: [{ id: "org-1", name: "UET", code: null }],
  branches: [
    { id: "branch-1", name: "Downtown", code: null, organizationId: "org-1" },
  ],
  academicYears: [
    {
      id: "ay-2026",
      name: "AY 2026-27",
      code: null,
      organizationId: "org-1",
      branchId: null,
    },
  ],
};

describe("workspace selection validation", () => {
  it("accepts a selection whose every level is on offer", () => {
    expect(
      validateWorkspaceSelection(
        {
          organizationId: "org-1",
          branchId: "branch-1",
          academicYearId: "ay-2026",
        },
        OPTIONS,
      ),
    ).toEqual({ valid: true, message: null, field: null });
  });

  it("reports the first unmet level, not every one", () => {
    // Naming the academic year while no organization is chosen would describe a
    // problem the user cannot act on yet.
    const result = validateWorkspaceSelection(
      { organizationId: null, branchId: null, academicYearId: null },
      OPTIONS,
    );

    expect(result.valid).toBe(false);
    expect(result.field).toBe("organizationId");
    expect(result.message).toMatch(/organization/i);
  });

  it("walks down the levels as they are answered", () => {
    expect(
      validateWorkspaceSelection(
        { organizationId: "org-1", branchId: null, academicYearId: null },
        OPTIONS,
      ).field,
    ).toBe("branchId");

    expect(
      validateWorkspaceSelection(
        {
          organizationId: "org-1",
          branchId: "branch-1",
          academicYearId: null,
        },
        OPTIONS,
      ).field,
    ).toBe("academicYearId");
  });

  it("rejects an id that is not among the offered options", () => {
    // A selection restored from storage can name a scope since withdrawn.
    const result = validateWorkspaceSelection(
      {
        organizationId: "org-revoked",
        branchId: "branch-1",
        academicYearId: "ay-2026",
      },
      OPTIONS,
    );

    expect(result.valid).toBe(false);
    expect(result.field).toBe("organizationId");
  });
});
