import { describe, expect, it } from "vitest";

import { buildChecklist, matchesRequirementScope } from "@/features/documents";

import { documentDto, documentRequirementDto } from "@tests/fixtures/document";

describe("matchesRequirementScope", () => {
  it("matches a requirement with no scope restrictions against any owner", () => {
    const requirement = documentRequirementDto({
      appliesToProgramId: null,
      appliesToQuotaId: null,
      appliesToCategoryId: null,
    });

    expect(
      matchesRequirementScope(requirement, { programId: "program-1" }),
    ).toBe(true);
    expect(
      matchesRequirementScope(requirement, {
        programId: "program-2",
        quotaId: "quota-9",
        categoryId: "category-9",
      }),
    ).toBe(true);
  });

  it("excludes a requirement scoped to a different program", () => {
    const requirement = documentRequirementDto({ appliesToProgramId: "program-1" });

    expect(
      matchesRequirementScope(requirement, { programId: "program-2" }),
    ).toBe(false);
    expect(
      matchesRequirementScope(requirement, { programId: "program-1" }),
    ).toBe(true);
  });

  it("excludes on quota and category mismatch independently", () => {
    const requirement = documentRequirementDto({
      appliesToProgramId: null,
      appliesToQuotaId: "quota-1",
      appliesToCategoryId: "category-1",
    });

    expect(
      matchesRequirementScope(requirement, {
        programId: "program-1",
        quotaId: "quota-2",
        categoryId: "category-1",
      }),
    ).toBe(false);
    expect(
      matchesRequirementScope(requirement, {
        programId: "program-1",
        quotaId: "quota-1",
        categoryId: "category-2",
      }),
    ).toBe(false);
    expect(
      matchesRequirementScope(requirement, {
        programId: "program-1",
        quotaId: "quota-1",
        categoryId: "category-1",
      }),
    ).toBe(true);
  });

  it("treats a missing owner quota/category as not matching a requirement scoped to one", () => {
    const requirement = documentRequirementDto({ appliesToQuotaId: "quota-1" });

    expect(
      matchesRequirementScope(requirement, { programId: "program-1", quotaId: null }),
    ).toBe(false);
  });
});

describe("buildChecklist", () => {
  const scope = { programId: "program-1", quotaId: null, categoryId: null };

  it("excludes inactive requirements", () => {
    const requirements = [
      documentRequirementDto({ id: "r1", isActive: true }),
      documentRequirementDto({ id: "r2", isActive: false }),
    ];

    const items = buildChecklist(requirements, [], scope);

    expect(items).toHaveLength(1);
    expect(items[0]?.requirement.id).toBe("r1");
  });

  it("excludes requirements outside the given scope", () => {
    const requirements = [
      documentRequirementDto({ id: "r1", appliesToProgramId: "program-1" }),
      documentRequirementDto({ id: "r2", appliesToProgramId: "program-2" }),
    ];

    const items = buildChecklist(requirements, [], scope);

    expect(items.map((item) => item.requirement.id)).toEqual(["r1"]);
  });

  it("marks a requirement missing when no document exists for its type", () => {
    const requirements = [documentRequirementDto({ documentTypeId: "type-1" })];

    const [item] = buildChecklist(requirements, [], scope);

    expect(item?.state).toBe("missing");
    expect(item?.document).toBeNull();
  });

  it("reads state from the matching document's status", () => {
    const requirements = [documentRequirementDto({ documentTypeId: "type-1" })];
    const documents = [documentDto({ documentTypeId: "type-1", status: "VERIFIED" })];

    const [item] = buildChecklist(requirements, documents, scope);

    expect(item?.state).toBe("verified");
    expect(item?.document?.status).toBe("VERIFIED");
  });
});
