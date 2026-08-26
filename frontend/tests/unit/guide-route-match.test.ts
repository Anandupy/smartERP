import { describe, expect, it } from "vitest";

import {
  extractRouteParam,
  matchesRoute,
  stepsForRoute,
} from "@/core/guides/route-match";

describe("matchesRoute", () => {
  it("matches an exact, static route", () => {
    expect(matchesRoute("/app/academic-years", "/app/academic-years")).toBe(
      true,
    );
  });

  it("does not match a different static route", () => {
    expect(
      matchesRoute("/app/academic-years", "/app/academic-years/new"),
    ).toBe(false);
  });

  it("matches a dynamic segment against any value", () => {
    expect(
      matchesRoute("/app/academic-years/:id", "/app/academic-years/abc-123"),
    ).toBe(true);
  });

  it("does not match a route with a different segment count", () => {
    expect(
      matchesRoute(
        "/app/academic-years/:id",
        "/app/academic-years/abc-123/edit",
      ),
    ).toBe(false);
  });

  it("matches a dynamic segment nested under a static suffix", () => {
    expect(
      matchesRoute(
        "/app/academic-years/:id/lifecycle",
        "/app/academic-years/abc-123/lifecycle",
      ),
    ).toBe(true);
  });

  it("is insensitive to leading/trailing slashes", () => {
    expect(matchesRoute("/app/academic-years/", "app/academic-years")).toBe(
      true,
    );
  });
});

describe("extractRouteParam", () => {
  it("reads the value a dynamic segment matched", () => {
    expect(
      extractRouteParam(
        "/app/academic-years/:id",
        "/app/academic-years/abc-123",
        "id",
      ),
    ).toBe("abc-123");
  });

  it("returns null when the pattern has no such param", () => {
    expect(
      extractRouteParam("/app/academic-years", "/app/academic-years", "id"),
    ).toBeNull();
  });

  it("returns null when the route does not match at all", () => {
    expect(
      extractRouteParam(
        "/app/academic-years/:id",
        "/app/academic-years/abc-123/lifecycle",
        "id",
      ),
    ).toBeNull();
  });
});

describe("stepsForRoute", () => {
  const steps = [
    { id: "a", route: "/app/academic-years" },
    { id: "b", route: "/app/academic-years/new" },
    { id: "c", route: "/app/academic-years/:id" },
  ];

  it("returns only the steps whose route matches, in order", () => {
    expect(stepsForRoute(steps, "/app/academic-years/xyz")).toEqual([
      steps[2],
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(stepsForRoute(steps, "/app/branches")).toEqual([]);
  });
});
