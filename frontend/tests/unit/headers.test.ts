import { afterEach, describe, expect, it } from "vitest";

import { REQUEST_HEADERS } from "@/constants";
import { headerRegistry, registerDefaultHeaderProviders } from "@/core/api";

describe("header provider registry", () => {
  afterEach(() => headerRegistry.clear());

  it("omits providers that return nullish values", () => {
    headerRegistry.clear();
    headerRegistry.register(REQUEST_HEADERS.tenant, () => null);
    headerRegistry.register(REQUEST_HEADERS.branch, () => "branch-1");

    const resolved = headerRegistry.resolve();
    expect(resolved[REQUEST_HEADERS.tenant]).toBeUndefined();
    expect(resolved[REQUEST_HEADERS.branch]).toBe("branch-1");
  });

  it("always produces a request id by default", () => {
    headerRegistry.clear();
    registerDefaultHeaderProviders();
    const resolved = headerRegistry.resolve();
    expect(resolved[REQUEST_HEADERS.requestId]).toBeTruthy();
  });
});
