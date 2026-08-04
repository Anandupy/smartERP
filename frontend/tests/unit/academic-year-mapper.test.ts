import { describe, expect, it } from "vitest";

import {
  academicYearFormDefaults,
  academicYearFormSchema,
  academicYearState,
  findOverlappingYear,
  formatAcademicYearRange,
  readFlag,
  toAcademicYearFormValues,
  toAcademicYearRequest,
  toDateInputValue,
} from "@/features/academic-year";

import {
  academicYearDto,
  lockedAcademicYearDto,
} from "@tests/fixtures/academic-year";

describe("academic year mapper", () => {
  it("sends exactly the four documented request fields", () => {
    const body = toAcademicYearRequest({
      branchId: "branch-1",
      name: "2025-26",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
    });

    expect(Object.keys(body).sort()).toEqual([
      "branchId",
      "endDate",
      "name",
      "startDate",
    ]);
  });

  it("never sends the three state flags", () => {
    // They are documented fields of the entity and of neither request body:
    // `isActive`/`isSelected` come from the backend's auto-selection rule, and
    // all three change only through the dedicated lifecycle endpoints.
    const body = toAcademicYearRequest(academicYearFormDefaults("branch-1"));

    expect(body).not.toHaveProperty("isActive");
    expect(body).not.toHaveProperty("isSelected");
    expect(body).not.toHaveProperty("isLocked");
  });

  it("trims the name before sending it", () => {
    const body = toAcademicYearRequest({
      branchId: "branch-1",
      name: "  2025-26  ",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
    });

    expect(body.name).toBe("2025-26");
  });

  it("round-trips a loaded year back into form values", () => {
    const values = toAcademicYearFormValues(academicYearDto());

    expect(values).toEqual({
      branchId: "branch-1",
      name: "2025-26",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
    });
  });

  describe("toDateInputValue", () => {
    it("passes the documented YYYY-MM-DD format through untouched", () => {
      expect(toDateInputValue("2025-04-01")).toBe("2025-04-01");
    });

    it("truncates a full ISO timestamp to its date part", () => {
      // The wire format is not typed anywhere in the documentation. Tolerating
      // a timestamp on read costs nothing; failing to would blank the field.
      expect(toDateInputValue("2025-04-01T00:00:00.000Z")).toBe("2025-04-01");
    });

    it("returns an empty string for a missing date", () => {
      expect(toDateInputValue(null)).toBe("");
      expect(toDateInputValue(undefined)).toBe("");
      expect(toDateInputValue("")).toBe("");
    });
  });

  describe("formatAcademicYearRange", () => {
    it("returns null rather than a half-formed range", () => {
      // "1 Apr 2025 – Invalid Date" is worse than no caption at all.
      expect(
        formatAcademicYearRange({ startDate: "2025-04-01", endDate: "nope" }),
      ).toBeNull();
      expect(
        formatAcademicYearRange({ startDate: "", endDate: "2026-03-31" }),
      ).toBeNull();
    });

    it("joins both bounds when they are readable", () => {
      const range = formatAcademicYearRange(academicYearDto());
      expect(range).toContain("–");
    });
  });
});

describe("academic year state", () => {
  it("leads with locked, because locked is the flag that stops writes", () => {
    // A year that is both current and locked shows "Locked": a user needs to
    // know writes are frozen before they try to record anything against it.
    const year = academicYearDto({ isSelected: true, isLocked: true });
    expect(academicYearState(year)).toBe("locked");
  });

  it("reports a selected year as current", () => {
    expect(
      academicYearState(
        academicYearDto({ isSelected: true, isLocked: false }),
      ),
    ).toBe("selected");
  });

  it("falls back to active and inactive", () => {
    expect(
      academicYearState(
        academicYearDto({ isActive: true, isSelected: false, isLocked: false }),
      ),
    ).toBe("active");
    expect(
      academicYearState(
        academicYearDto({ isActive: false, isSelected: false, isLocked: false }),
      ),
    ).toBe("inactive");
  });

  it("reports an unreported flag as unknown, never as inactive", () => {
    // No response body is documented, so the flags genuinely may be absent.
    // Defaulting them to `false` would present a live year as closed.
    const year = academicYearDto({
      isActive: undefined,
      isSelected: undefined,
      isLocked: undefined,
    });
    expect(academicYearState(year)).toBe("unknown");
  });

  it("distinguishes a false flag from an absent one", () => {
    expect(readFlag(true)).toBe("yes");
    expect(readFlag(false)).toBe("no");
    expect(readFlag(undefined)).toBe("unknown");
    expect(readFlag(null)).toBe("unknown");
  });
});

describe("academic year form schema", () => {
  const valid = {
    branchId: "branch-1",
    name: "2025-26",
    startDate: "2025-04-01",
    endDate: "2026-03-31",
  };

  it("accepts the documented sample", () => {
    expect(academicYearFormSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces documented rule 1: the start must precede the end", () => {
    const result = academicYearFormSchema.safeParse({
      ...valid,
      startDate: "2026-03-31",
      endDate: "2025-04-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["endDate"]);
    }
  });

  it("rejects a zero-length year, since the end must fall after the start", () => {
    const result = academicYearFormSchema.safeParse({
      ...valid,
      startDate: "2025-04-01",
      endDate: "2025-04-01",
    });

    expect(result.success).toBe(false);
  });

  it("requires the documented YYYY-MM-DD format", () => {
    expect(
      academicYearFormSchema.safeParse({ ...valid, startDate: "01/04/2025" })
        .success,
    ).toBe(false);
  });

  it("imposes no format on the name, because the backend documents none", () => {
    expect(
      academicYearFormSchema.safeParse({
        ...valid,
        name: "Academic Year 2025 (Spring Intake)",
      }).success,
    ).toBe(true);
  });

  it("seeds a blank year with the branch and nothing else", () => {
    // Seeding the dates from the Postman sample would put an Indian April-March
    // calendar into a school whose year runs September to July.
    expect(academicYearFormDefaults("branch-9")).toEqual({
      branchId: "branch-9",
      name: "",
      startDate: "",
      endDate: "",
    });
  });
});

describe("findOverlappingYear — documented rule 2", () => {
  const existing = [academicYearDto(), lockedAcademicYearDto()];

  it("finds a year whose range intersects the proposed one", () => {
    const clash = findOverlappingYear(existing, {
      startDate: "2025-06-01",
      endDate: "2026-06-30",
    });

    expect(clash?.id).toBe("ay-1");
  });

  it("treats bounds as inclusive: sharing a single day is an overlap", () => {
    // The documentation describes a year by its first and last day, not by a
    // half-open range, so 31 Mar 2026 belongs to the 2025-26 year.
    const clash = findOverlappingYear(existing, {
      startDate: "2026-03-31",
      endDate: "2027-03-31",
    });

    expect(clash?.id).toBe("ay-1");
  });

  it("allows a range that starts the day after an existing year ends", () => {
    expect(
      findOverlappingYear(existing, {
        startDate: "2026-04-01",
        endDate: "2027-03-31",
      }),
    ).toBeNull();
  });

  it("does not report a record as overlapping itself when editing", () => {
    expect(
      findOverlappingYear(
        existing,
        { startDate: "2025-04-01", endDate: "2026-03-31" },
        "ay-1",
      ),
    ).toBeNull();
  });

  it("stays silent while a date is still being typed", () => {
    expect(
      findOverlappingYear(existing, { startDate: "2025", endDate: "" }),
    ).toBeNull();
  });
});
