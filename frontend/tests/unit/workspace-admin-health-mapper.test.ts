import { describe, expect, it } from "vitest";

import {
  deriveOverallState,
  formatUptime,
  mapHealthStatus,
  mapIndicatorStatus,
} from "@/features/workspace-admin";

describe("mapHealthStatus — liveness", () => {
  it("is live on a 200 response", () => {
    expect(mapHealthStatus("live", { httpOk: true, httpStatus: 200 })).toBe("live");
  });

  it("is down on a real non-2xx response — the process answered, just not with ok", () => {
    expect(mapHealthStatus("live", { httpOk: false, httpStatus: 500 })).toBe("down");
  });

  it("is unknown when no response ever arrived — never assumed to mean the database is down", () => {
    expect(mapHealthStatus("live", { httpOk: false, httpStatus: null })).toBe(
      "unknown",
    );
  });
});

describe("mapHealthStatus — readiness", () => {
  it("is ready on 200", () => {
    expect(mapHealthStatus("ready", { httpOk: true, httpStatus: 200 })).toBe(
      "ready",
    );
  });

  it("is not-ready on 503 — the documented database-unreachable case", () => {
    expect(mapHealthStatus("ready", { httpOk: false, httpStatus: 503 })).toBe(
      "not-ready",
    );
  });

  it("is unknown on a network failure, not not-ready", () => {
    expect(mapHealthStatus("ready", { httpOk: false, httpStatus: null })).toBe(
      "unknown",
    );
  });
});

describe("mapHealthStatus — dependency health", () => {
  it("is healthy when data.status is ok", () => {
    expect(
      mapHealthStatus("health", {
        httpOk: true,
        httpStatus: 200,
        data: { status: "ok" },
      }),
    ).toBe("healthy");
  });

  it("is degraded when data.status is not ok despite a 200", () => {
    expect(
      mapHealthStatus("health", {
        httpOk: true,
        httpStatus: 200,
        data: { status: "shutting_down" },
      }),
    ).toBe("degraded");
  });

  it("is degraded on 503", () => {
    expect(mapHealthStatus("health", { httpOk: false, httpStatus: 503 })).toBe(
      "degraded",
    );
  });

  it("is unknown on a network failure", () => {
    expect(mapHealthStatus("health", { httpOk: false, httpStatus: null })).toBe(
      "unknown",
    );
  });
});

describe("mapIndicatorStatus", () => {
  it.each([
    ["up", "up"],
    ["down", "down"],
    [undefined, "unknown"],
    ["degraded", "unknown"],
  ] as const)("maps %s to %s", (raw, expected) => {
    expect(mapIndicatorStatus(raw)).toBe(expected);
  });
});

describe("deriveOverallState", () => {
  it("is healthy only when all three dimensions are healthy", () => {
    expect(deriveOverallState("live", "ready", "healthy")).toBe("healthy");
  });

  it("is degraded when traffic is not ready but the process is alive — never 'application down'", () => {
    expect(deriveOverallState("live", "not-ready", "degraded")).toBe("degraded");
  });

  it("is unavailable when the process itself is down", () => {
    expect(deriveOverallState("down", "not-ready", "degraded")).toBe(
      "unavailable",
    );
  });

  it("is unknown, not 'database down', when every probe is unreachable", () => {
    expect(deriveOverallState("unknown", "unknown", "unknown")).toBe("unknown");
  });
});

describe("formatUptime", () => {
  it("formats seconds into a human duration", () => {
    expect(formatUptime(3661)).toBe("1h 1m 1s");
  });

  it("handles a value under a minute", () => {
    expect(formatUptime(42)).toBe("42s");
  });

  it("is defensive about a nonsensical value", () => {
    expect(formatUptime(-1)).toBe("Unknown");
  });
});
