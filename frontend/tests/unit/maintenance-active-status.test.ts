import { describe, expect, it } from "vitest";

// The module under test, not the feature barrel — see the note in
// `audit-analytics.test.ts`.
import { readActiveStatus } from "@/features/maintenance/utils/active-status";

/**
 * `GET /maintenance-rules/active/status` has a documented meaning and no
 * documented response body. These cases pin the one behaviour that matters:
 * an unreadable answer must never be reported as "all clear", and a shape the
 * reader does not know must never be reported as a maintenance window.
 */
describe("readActiveStatus", () => {
  it("treats no payload as nothing active", () => {
    expect(readActiveStatus(null).isUnderMaintenance).toBe(false);
    expect(readActiveStatus(undefined).isUnrecognized).toBe(false);
  });

  it("treats an empty object as nothing active, not as unrecognized", () => {
    const status = readActiveStatus({});

    expect(status.isUnderMaintenance).toBe(false);
    expect(status.isUnrecognized).toBe(false);
  });

  it("honours a bare boolean answer", () => {
    expect(readActiveStatus(true).isUnderMaintenance).toBe(true);
    expect(readActiveStatus(false).isUnderMaintenance).toBe(false);
  });

  it("reads a rule returned at the top level", () => {
    const status = readActiveStatus({
      scopeType: "BRANCH",
      isActive: true,
      title: "Upgrade",
      shortMessage: "Back at 04:00",
      customPage: "https://status.example.com",
    });

    expect(status).toMatchObject({
      isUnderMaintenance: true,
      title: "Upgrade",
      message: "Back at 04:00",
      scopeType: "BRANCH",
      customPage: "https://status.example.com",
      isUnrecognized: false,
    });
  });

  it("reads a rule nested under a wrapper key", () => {
    const status = readActiveStatus({
      isUnderMaintenance: true,
      rule: { scopeType: "GLOBAL", title: "Planned work" },
    });

    expect(status.isUnderMaintenance).toBe(true);
    expect(status.title).toBe("Planned work");
    expect(status.scopeType).toBe("GLOBAL");
  });

  it("falls back to the description when there is no short message", () => {
    const status = readActiveStatus({
      isActive: true,
      description: "Indexing the database",
    });

    expect(status.message).toBe("Indexing the database");
  });

  it("ignores a scope value outside the documented enum", () => {
    const status = readActiveStatus({ isActive: true, scopeType: "PLANET" });

    expect(status.scopeType).toBeNull();
    expect(status.isUnderMaintenance).toBe(true);
  });

  it("reports an unreadable payload rather than claiming all is well", () => {
    const status = readActiveStatus({ somethingElse: 42 });

    expect(status.isUnderMaintenance).toBe(false);
    expect(status.isUnrecognized).toBe(true);
  });

  it("does not report an explicit negative as unrecognized", () => {
    const status = readActiveStatus({ isUnderMaintenance: false });

    expect(status.isUnderMaintenance).toBe(false);
    expect(status.isUnrecognized).toBe(false);
  });

  it("reports a non-object payload as unrecognized", () => {
    expect(readActiveStatus("under maintenance").isUnrecognized).toBe(true);
  });
});
