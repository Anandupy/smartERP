import { describe, expect, it } from "vitest";

// The modules under test, not the feature barrel — see the note in
// `audit-analytics.test.ts`.
import {
  formatAddress,
  toDateInput,
  toOrganizationFormValues,
  toOrganizationRequest,
} from "@/features/organization/mappers/organization.mapper";
import {
  organizationFormDefaults,
  organizationFormSchema,
} from "@/features/organization/schemas/organization.schema";

import { organizationDto } from "@tests/fixtures/organization";

describe("organization mapper", () => {
  it("sends exactly the fourteen documented request fields", () => {
    // `status` is a documented field of the entity and of neither request
    // body, so it must never reach the wire.
    const body = toOrganizationRequest(organizationFormDefaults());

    expect(Object.keys(body).sort()).toEqual(
      [
        "addressLine1",
        "addressLine2",
        "city",
        "code",
        "contactEmail",
        "contactPhone",
        "country",
        "currency",
        "logoUrl",
        "masterExpiryDate",
        "name",
        "pincode",
        "state",
        "timezone",
      ].sort(),
    );
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("id");
  });

  it("sends the two documented optionals as null when blank", () => {
    const body = toOrganizationRequest({
      ...organizationFormDefaults(),
      logoUrl: "   ",
      addressLine2: "",
    });

    expect(body.logoUrl).toBeNull();
    expect(body.addressLine2).toBeNull();
  });

  it("keeps the optionals when they are set", () => {
    const body = toOrganizationRequest({
      ...organizationFormDefaults(),
      logoUrl: " https://cdn.example.com/logo.png ",
      addressLine2: " Financial District ",
    });

    expect(body.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(body.addressLine2).toBe("Financial District");
  });

  it("round-trips a loaded organization back into a request", () => {
    const organization = organizationDto({
      name: "Avalon",
      code: "avalon",
      currency: "GBP",
    });

    const body = toOrganizationRequest(toOrganizationFormValues(organization));

    expect(body.name).toBe("Avalon");
    expect(body.code).toBe("avalon");
    expect(body.currency).toBe("GBP");
    expect(body.masterExpiryDate).toBe("2099-12-31");
  });

  it("presents a null optional as an empty field rather than the string null", () => {
    const values = toOrganizationFormValues(
      organizationDto({ logoUrl: null, addressLine2: null }),
    );

    expect(values.logoUrl).toBe("");
    expect(values.addressLine2).toBe("");
  });
});

describe("toDateInput", () => {
  it("passes a date-only value through, which is what the sample sends", () => {
    expect(toDateInput("2030-12-31")).toBe("2030-12-31");
  });

  it("truncates a full ISO timestamp, since the field is typed DateTime", () => {
    expect(toDateInput("2030-12-31T18:30:00.000Z")).toBe("2030-12-31");
  });

  it("gives an empty field for a missing or unreadable value", () => {
    expect(toDateInput(null)).toBe("");
    expect(toDateInput(undefined)).toBe("");
    expect(toDateInput("not a date")).toBe("");
  });
});

describe("formatAddress", () => {
  it("joins the lines that are set", () => {
    expect(formatAddress(organizationDto())).toBe(
      "100 Corporate Towers, Financial District, Mumbai, Maharashtra, India, 400001",
    );
  });

  it("skips a missing optional line rather than leaving a gap", () => {
    expect(formatAddress(organizationDto({ addressLine2: null }))).toBe(
      "100 Corporate Towers, Mumbai, Maharashtra, India, 400001",
    );
  });
});

describe("organization schema", () => {
  const valid = {
    ...organizationFormDefaults(),
    name: "Horizon Education Trust",
    code: "horizon-trust",
    contactEmail: "admin@horizon.edu",
    contactPhone: "9876543210",
    masterExpiryDate: "2030-12-31",
    addressLine1: "100 Corporate Towers",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    pincode: "400001",
    timezone: "Asia/Kolkata",
    currency: "INR",
  };

  it("accepts a complete organization", () => {
    expect(organizationFormSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces the one documented format rule — a slug-safe lowercase code", () => {
    for (const code of [
      "Horizon",
      "horizon trust",
      "horizon_trust",
      "-x",
      "x-",
    ]) {
      expect(organizationFormSchema.safeParse({ ...valid, code }).success).toBe(
        false,
      );
    }
  });

  it("accepts the code shapes the rule allows", () => {
    for (const code of ["horizon", "horizon-trust", "h2o-labs", "abc123"]) {
      expect(organizationFormSchema.safeParse({ ...valid, code }).success).toBe(
        true,
      );
    }
  });

  it("treats the two documented optionals as optional", () => {
    const result = organizationFormSchema.safeParse({
      ...valid,
      logoUrl: "",
      addressLine2: "",
    });

    expect(result.success).toBe(true);
  });

  it("requires a contact email that looks like one", () => {
    expect(
      organizationFormSchema.safeParse({ ...valid, contactEmail: "nope" })
        .success,
    ).toBe(false);
  });

  it("asserts no format on fields the backend documents none for", () => {
    // A pincode or phone pattern would be a rule the frontend made up.
    const result = organizationFormSchema.safeParse({
      ...valid,
      pincode: "SW1A 1AA",
      contactPhone: "+44 20 7946 0100",
      currency: "GBP",
    });

    expect(result.success).toBe(true);
  });
});
