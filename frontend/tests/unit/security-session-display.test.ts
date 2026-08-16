import { describe, expect, it } from "vitest";

import { Monitor, Smartphone, Tablet, CircleHelp } from "@/assets/icons";
import {
  sessionDeviceIcon,
  sessionDeviceLabel,
  sortSessionsByRecency,
} from "@/features/security";

describe("sessionDeviceIcon", () => {
  it("maps each documented device bucket to its icon", () => {
    expect(sessionDeviceIcon("Desktop")).toBe(Monitor);
    expect(sessionDeviceIcon("Mobile")).toBe(Smartphone);
    expect(sessionDeviceIcon("Tablet")).toBe(Tablet);
  });

  it("falls back rather than guessing for anything unrecognized", () => {
    expect(sessionDeviceIcon(null)).toBe(CircleHelp);
    expect(sessionDeviceIcon("Unknown")).toBe(CircleHelp);
  });
});

describe("sessionDeviceLabel", () => {
  it("labels a null device rather than showing a blank", () => {
    expect(sessionDeviceLabel(null)).toBe("Unknown device");
    expect(sessionDeviceLabel("Desktop")).toBe("Desktop");
  });
});

describe("sortSessionsByRecency", () => {
  const session = (id: string, createdAt: string) => ({
    id,
    device: "Desktop",
    ipAddress: null,
    userAgent: null,
    createdAt,
  });

  it("puts the most recently created session first", () => {
    const sorted = sortSessionsByRecency([
      session("old", "2026-01-01T00:00:00.000Z"),
      session("new", "2026-06-01T00:00:00.000Z"),
    ]);

    expect(sorted.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("does not mutate the input array", () => {
    const input = [session("a", "2026-01-01T00:00:00.000Z")];
    sortSessionsByRecency(input);
    expect(input[0]!.id).toBe("a");
  });
});
