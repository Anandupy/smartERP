import { afterEach, describe, expect, it } from "vitest";

import { headerRegistry } from "@/core/api";
import {
  createMemoryWorkspaceStorage,
  registerWorkspaceHeaders,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";

/**
 * The scope headers must use the names the backend documents —
 * `x-organization-id`, `x-branch-id`, `x-academic-year-id` — and be sent only
 * once the workspace scope is `ready`. Header names are case-insensitive, so
 * they are compared lower-cased.
 */

function sent(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headerRegistry.resolve()).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ]),
  );
}

let unregister: (() => void) | null = null;

afterEach(() => {
  unregister?.();
  unregister = null;
});

describe("workspace scope headers", () => {
  it("sends organization, branch and academic year under the documented names", () => {
    setWorkspaceStorage(createMemoryWorkspaceStorage());
    useWorkspaceStore.setState({
      selection: {
        organizationId: "org-1",
        branchId: "branch-1",
        academicYearId: "ay-1",
      },
      status: "ready",
      reason: null,
    });
    unregister = registerWorkspaceHeaders();

    const headers = sent();
    expect(headers["x-organization-id"]).toBe("org-1");
    expect(headers["x-branch-id"]).toBe("branch-1");
    expect(headers["x-academic-year-id"]).toBe("ay-1");
  });

  it("no longer sends the legacy alias names", () => {
    setWorkspaceStorage(createMemoryWorkspaceStorage());
    useWorkspaceStore.setState({
      selection: {
        organizationId: "org-1",
        branchId: "branch-1",
        academicYearId: "ay-1",
      },
      status: "ready",
      reason: null,
    });
    unregister = registerWorkspaceHeaders();

    const headers = sent();
    expect(headers).not.toHaveProperty("x-tenant-id");
    expect(headers).not.toHaveProperty("x-academic-year");
  });

  it("sends no scope header until the scope is ready", () => {
    setWorkspaceStorage(createMemoryWorkspaceStorage());
    useWorkspaceStore.setState({
      selection: {
        organizationId: "org-1",
        branchId: null,
        academicYearId: null,
      },
      status: "selecting",
      reason: null,
    });
    unregister = registerWorkspaceHeaders();

    const headers = sent();
    expect(headers).not.toHaveProperty("x-organization-id");
    expect(headers).not.toHaveProperty("x-branch-id");
    expect(headers).not.toHaveProperty("x-academic-year-id");
  });
});
