import { describe, expect, it } from "vitest";

import {
  admissionMasterFormDefaults,
  admissionMasterFormSchema,
} from "@/features/admission-masters";

describe("Admission master form schema", () => {
  it("requires code and name", () => {
    const result = admissionMasterFormSchema.safeParse({
      ...admissionMasterFormDefaults(),
      code: "",
      name: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain("code");
      expect(paths).toContain("name");
    }
  });

  it("accepts a description-less, zero-order record", () => {
    const result = admissionMasterFormSchema.safeParse({
      code: "O_POS",
      name: "O Positive",
      description: "",
      displayOrder: 0,
      isActive: true,
    });

    expect(result.success).toBe(true);
  });

  it("coerces a stringly-typed display order from the number input", () => {
    const result = admissionMasterFormSchema.safeParse({
      code: "O_POS",
      name: "O Positive",
      description: "",
      displayOrder: "3",
      isActive: true,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.displayOrder).toBe(3);
  });

  it("defaults to a blank, active record starting at display order 0", () => {
    expect(admissionMasterFormDefaults()).toEqual({
      code: "",
      name: "",
      description: "",
      displayOrder: 0,
      isActive: true,
    });
  });
});
