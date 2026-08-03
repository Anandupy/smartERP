import { describe, expect, it } from "vitest";

// The modules under test, not the feature barrel — see the note in
// `audit-analytics.test.ts`.
import {
  formatAffiliation,
  formatBranchAddress,
  toBranchFormValues,
  toBranchRequest,
} from "@/features/branch/mappers/branch.mapper";
import {
  NO_AFFILIATION,
  branchFormDefaults,
  branchFormSchema,
} from "@/features/branch/schemas/branch.schema";

import { branchDto } from "@tests/fixtures/branch";

const validValues = {
  ...branchFormDefaults("org-1"),
  name: "Horizon High School — North Campus",
  code: "hhs-north",
  contactEmail: "north.branch@horizon.edu",
  contactPhone: "9876543210",
  addressLine1: "123 Education Lane",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  pincode: "400001",
};

describe("branch mapper", () => {
  it("sends exactly the seventeen documented request fields", () => {
    // isActive and isDeleted are documented fields of the entity and of
    // neither request body, so they must never reach the wire.
    const body = toBranchRequest(validValues);

    expect(Object.keys(body).sort()).toEqual(
      [
        "addressLine1",
        "addressLine2",
        "affiliationName",
        "affiliationType",
        "city",
        "code",
        "contactEmail",
        "contactPhone",
        "country",
        "institutionType",
        "logoUrl",
        "name",
        "organizationId",
        "pincode",
        "registrationNumber",
        "state",
        "structureMode",
      ].sort(),
    );
    expect(body).not.toHaveProperty("isActive");
    expect(body).not.toHaveProperty("isDeleted");
    expect(body).not.toHaveProperty("id");
  });

  it("sends the documented optionals as null when blank", () => {
    const body = toBranchRequest({
      ...validValues,
      registrationNumber: "   ",
      logoUrl: "",
      addressLine2: "",
    });

    expect(body.registrationNumber).toBeNull();
    expect(body.logoUrl).toBeNull();
    expect(body.addressLine2).toBeNull();
  });

  it("clears both affiliation fields together when none is declared", () => {
    // A name without a type describes nothing, so the pair travels together.
    const body = toBranchRequest({
      ...validValues,
      affiliationType: NO_AFFILIATION,
      affiliationName: "Left over from an earlier choice",
    });

    expect(body.affiliationType).toBeNull();
    expect(body.affiliationName).toBeNull();
  });

  it("sends both affiliation fields when one is declared", () => {
    const body = toBranchRequest({
      ...validValues,
      affiliationType: "BOARD",
      affiliationName: "CBSE",
    });

    expect(body.affiliationType).toBe("BOARD");
    expect(body.affiliationName).toBe("CBSE");
  });

  it("round-trips a loaded branch back into a request", () => {
    const branch = branchDto({
      institutionType: "UNIVERSITY",
      structureMode: "CUSTOM",
      affiliationType: "UNIVERSITY",
      affiliationName: "Mumbai University",
    });

    const body = toBranchRequest(toBranchFormValues(branch));

    expect(body.institutionType).toBe("UNIVERSITY");
    expect(body.structureMode).toBe("CUSTOM");
    expect(body.affiliationName).toBe("Mumbai University");
    expect(body.organizationId).toBe("org-1");
  });

  it("presents a branch with no affiliation as the no-affiliation choice", () => {
    const values = toBranchFormValues(
      branchDto({ affiliationType: null, affiliationName: null }),
    );

    expect(values.affiliationType).toBe(NO_AFFILIATION);
    expect(values.affiliationName).toBe("");
  });

  it("falls back to documented defaults when a field was not returned", () => {
    // No response body is documented, so these may genuinely be absent.
    const values = toBranchFormValues(
      branchDto({ institutionType: null, structureMode: null }),
    );

    expect(values.institutionType).toBe("SCHOOL");
    expect(values.structureMode).toBe("DEFAULT");
  });
});

describe("formatBranchAddress", () => {
  it("joins the lines that are set", () => {
    expect(formatBranchAddress(branchDto())).toBe(
      "123 Education Lane, Suite 400, Mumbai, Maharashtra, India, 400001",
    );
  });

  it("skips a missing optional line rather than leaving a gap", () => {
    expect(formatBranchAddress(branchDto({ addressLine2: null }))).toBe(
      "123 Education Lane, Mumbai, Maharashtra, India, 400001",
    );
  });
});

describe("formatAffiliation", () => {
  it("reads name and type together", () => {
    expect(formatAffiliation(branchDto())).toBe("CBSE · BOARD");
  });

  it("is null when the branch declares none", () => {
    expect(
      formatAffiliation(
        branchDto({ affiliationType: null, affiliationName: null }),
      ),
    ).toBeNull();
  });
});

describe("branch schema", () => {
  it("accepts a complete branch", () => {
    expect(branchFormSchema.safeParse(validValues).success).toBe(true);
  });

  it("enforces the documented slug-safe lowercase code", () => {
    for (const code of ["HHS", "hhs north", "hhs_north", "-x", "x-"]) {
      expect(branchFormSchema.safeParse({ ...validValues, code }).success).toBe(
        false,
      );
    }
  });

  it("requires an affiliating body once a type is chosen", () => {
    const result = branchFormSchema.safeParse({
      ...validValues,
      affiliationType: "BOARD",
      affiliationName: "",
    });

    expect(result.success).toBe(false);
    expect(
      result.success ? [] : result.error.issues.map((issue) => issue.path[0]),
    ).toContain("affiliationName");
  });

  it("accepts a branch that declares no affiliation at all", () => {
    expect(
      branchFormSchema.safeParse({
        ...validValues,
        affiliationType: NO_AFFILIATION,
        affiliationName: "",
      }).success,
    ).toBe(true);
  });

  it("treats registration number as optional, as documented", () => {
    expect(
      branchFormSchema.safeParse({ ...validValues, registrationNumber: "" })
        .success,
    ).toBe(true);
  });

  it("requires a parent organization", () => {
    expect(
      branchFormSchema.safeParse({ ...validValues, organizationId: "" })
        .success,
    ).toBe(false);
  });

  it("asserts no format on fields the backend documents none for", () => {
    // A pincode or phone pattern would be a rule the frontend made up.
    expect(
      branchFormSchema.safeParse({
        ...validValues,
        pincode: "SW1A 1AA",
        contactPhone: "+44 20 7946 0100",
      }).success,
    ).toBe(true);
  });
});
