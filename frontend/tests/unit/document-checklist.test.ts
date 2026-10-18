import { describe, expect, it } from "vitest";

import {
  checklistFromServer,
  checklistSummary,
  type ServerChecklistItem,
} from "@/features/documents";

import { documentDto, documentRequirementDto } from "@tests/fixtures/document";

function serverItem(
  overrides: Partial<ServerChecklistItem> = {},
): ServerChecklistItem {
  return {
    requirementId: "r1",
    documentTypeId: "type-1",
    name: "Birth certificate",
    requiredByStage: "UNDER_REVIEW",
    isMandatory: true,
    branchId: null,
    status: "MISSING",
    documentId: null,
    ...overrides,
  };
}

describe("checklistFromServer", () => {
  it("renders exactly the requirements the server says bind the applicant", () => {
    // `r2` is in the branch's requirement list (another programme, or another
    // branch) but the server did not include it — it must not appear.
    const requirements = [
      documentRequirementDto({ id: "r1", documentTypeId: "type-1" }),
      documentRequirementDto({ id: "r2", documentTypeId: "type-2" }),
    ];

    const items = checklistFromServer([serverItem()], requirements, []);

    expect(items.map((item) => item.requirement.id)).toEqual(["r1"]);
  });

  it.each([
    ["VERIFIED", "verified"],
    ["PENDING_VERIFICATION", "pending"],
    ["REJECTED", "rejected"],
    ["MISSING", "missing"],
  ] as const)("maps %s to the %s row state", (status, state) => {
    const [item] = checklistFromServer([serverItem({ status })], [], []);
    expect(item?.state).toBe(state);
  });

  it("attaches the document the server named, for the row's actions", () => {
    const documents = [
      documentDto({
        id: "d-old",
        documentTypeId: "type-1",
        status: "REJECTED",
      }),
      documentDto({
        id: "d-new",
        documentTypeId: "type-1",
        status: "VERIFIED",
      }),
    ];

    const [item] = checklistFromServer(
      [serverItem({ status: "VERIFIED", documentId: "d-new" })],
      [],
      documents,
    );

    expect(item?.document?.id).toBe("d-new");
  });

  it("falls back to the applicant's document of that type", () => {
    const documents = [documentDto({ id: "d-1", documentTypeId: "type-1" })];
    const [item] = checklistFromServer(
      [serverItem({ status: "PENDING_VERIFICATION" })],
      [],
      documents,
    );
    expect(item?.document?.id).toBe("d-1");
  });

  it("keeps the server's name and mandatory flag when the requirement list lacks the row", () => {
    const [item] = checklistFromServer(
      [serverItem({ isMandatory: false, name: "Transfer certificate" })],
      [],
      [],
    );
    expect(item?.requirement.documentType?.name).toBe("Transfer certificate");
    expect(item?.requirement.isMandatory).toBe(false);
  });
});

describe("checklistSummary", () => {
  it("counts verified mandatory requirements only", () => {
    const items = checklistFromServer(
      [
        serverItem({ requirementId: "a", status: "VERIFIED" }),
        serverItem({ requirementId: "b", status: "MISSING" }),
        serverItem({
          requirementId: "c",
          status: "VERIFIED",
          isMandatory: false,
        }),
      ],
      [],
      [],
    );

    expect(checklistSummary(items)).toEqual({
      total: 2,
      verified: 1,
      isSatisfied: false,
    });
  });
});
