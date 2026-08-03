import { describe, expect, it } from "vitest";

// The modules under test, not the feature barrel — see the note in
// `audit-analytics.test.ts`.
import {
  toRuleFormValues,
  toRuleRequest,
} from "@/features/maintenance/mappers/maintenance.mapper";
import {
  maintenanceRuleFormDefaults,
  maintenanceRuleFormSchema,
} from "@/features/maintenance/schemas/maintenance-rule.schema";

import { maintenanceRuleDto } from "@tests/fixtures/maintenance";

describe("maintenance rule mapper", () => {
  it("sends null scopeId for a global rule, whatever the field still holds", () => {
    const body = toRuleRequest({
      ...maintenanceRuleFormDefaults(),
      scopeType: "GLOBAL",
      scopeId: "left-over-from-an-earlier-choice",
    });

    expect(body.scopeId).toBeNull();
  });

  it("keeps the target for a scoped rule", () => {
    const body = toRuleRequest({
      ...maintenanceRuleFormDefaults(),
      scopeType: "BRANCH",
      scopeId: "branch-7",
    });

    expect(body.scopeId).toBe("branch-7");
  });

  it("splits comma-separated bypass roles into the documented JSON array", () => {
    const body = toRuleRequest({
      ...maintenanceRuleFormDefaults(),
      bypassRoles: " DEVOPS , SYSTEM_ADMIN ,, ",
    });

    expect(body.bypassRoles).toEqual(["DEVOPS", "SYSTEM_ADMIN"]);
  });

  it("sends an empty role list rather than an array with an empty string", () => {
    const body = toRuleRequest({
      ...maintenanceRuleFormDefaults(),
      bypassRoles: "   ",
    });

    expect(body.bypassRoles).toEqual([]);
  });

  it("converts the status control's string to the documented number", () => {
    const body = toRuleRequest({
      ...maintenanceRuleFormDefaults(),
      customStatus: "423",
    });

    expect(body.customStatus).toBe(423);
  });

  it("converts a datetime-local value to ISO-8601", () => {
    const body = toRuleRequest({
      ...maintenanceRuleFormDefaults(),
      startAt: "2026-08-03T02:00",
    });

    expect(body.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.endAt).toBeNull();
  });

  it("clears recurrence fields when the window is not recurring", () => {
    // Otherwise a weekly window switched off would keep applying invisibly.
    const body = toRuleRequest({
      ...maintenanceRuleFormDefaults(),
      isRecurring: false,
      recurrenceDayOfWeek: "1",
      recurrenceStartTime: "02:00",
      recurrenceEndTime: "04:00",
    });

    expect(body.recurrenceDayOfWeek).toBeNull();
    expect(body.recurrenceStartTime).toBeNull();
    expect(body.recurrenceEndTime).toBeNull();
  });

  it("sends recurrence as documented when the window is recurring", () => {
    const body = toRuleRequest({
      ...maintenanceRuleFormDefaults(),
      isRecurring: true,
      recurrenceDayOfWeek: "0",
      recurrenceStartTime: "02:00",
      recurrenceEndTime: "04:00",
    });

    expect(body.recurrenceDayOfWeek).toBe(0);
    expect(body.recurrenceStartTime).toBe("02:00");
  });

  it("round-trips a loaded rule back into a request", () => {
    const rule = maintenanceRuleDto({
      scopeType: "MODULE",
      scopeId: "admissions",
      customStatus: 423,
      bypassRoles: ["DEVOPS", "SRE"],
    });

    const body = toRuleRequest(toRuleFormValues(rule));

    expect(body.scopeType).toBe("MODULE");
    expect(body.scopeId).toBe("admissions");
    expect(body.customStatus).toBe(423);
    expect(body.bypassRoles).toEqual(["DEVOPS", "SRE"]);
  });
});

describe("maintenance rule schema", () => {
  it("requires a target for every scope but GLOBAL", () => {
    const result = maintenanceRuleFormSchema.safeParse({
      ...maintenanceRuleFormDefaults(),
      scopeType: "BRANCH",
      scopeId: "",
    });

    expect(result.success).toBe(false);
    expect(
      result.success ? [] : result.error.issues.map((issue) => issue.path[0]),
    ).toContain("scopeId");
  });

  it("accepts a global rule with no target", () => {
    expect(
      maintenanceRuleFormSchema.safeParse(maintenanceRuleFormDefaults())
        .success,
    ).toBe(true);
  });

  it("rejects a window that ends before it starts", () => {
    const result = maintenanceRuleFormSchema.safeParse({
      ...maintenanceRuleFormDefaults(),
      startAt: "2026-08-03T04:00",
      endAt: "2026-08-03T02:00",
    });

    expect(result.success).toBe(false);
  });

  it("requires day and times once recurrence is enabled", () => {
    const result = maintenanceRuleFormSchema.safeParse({
      ...maintenanceRuleFormDefaults(),
      isRecurring: true,
    });

    expect(result.success).toBe(false);
    const paths = result.success
      ? []
      : result.error.issues.map((issue) => String(issue.path[0]));
    expect(paths).toEqual(
      expect.arrayContaining([
        "recurrenceDayOfWeek",
        "recurrenceStartTime",
        "recurrenceEndTime",
      ]),
    );
  });

  it("rejects a status outside the HTTP range", () => {
    expect(
      maintenanceRuleFormSchema.safeParse({
        ...maintenanceRuleFormDefaults(),
        customStatus: "999",
      }).success,
    ).toBe(false);
  });
});
