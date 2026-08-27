import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { GuideProvider, registerGuide } from "@/core/guides";
import { useGuideStore } from "@/core/guides/guide-store";
import { __resetGuideRegistryForTests } from "@/core/guides/registry";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import {
  BranchDashboardScreen,
  BranchDetailsScreen,
  BranchLifecycleScreen,
  CreateBranchScreen,
  branchesGuide,
} from "@/features/branch";
import { toWorkspaceAvailability } from "@/features/workspace";

import { successEnvelope } from "@tests/fixtures/api";
import { branchDto } from "@tests/fixtures/branch";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

/**
 * The Branches reference guide, wired into its real screens.
 *
 * Covers the property that makes this guide different from Academic Years'
 * and Organizations': its last step targets the lifecycle *timeline*, not an
 * action, and — crucially — never fires the real status toggle. The toggle
 * is non-idempotent (it flips `isActive` with no target state), so a guide
 * that advanced by clicking it for the user would be exactly the kind of
 * consequence-hiding automation `docs/guides.md` §11 rules out.
 */

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, setPathname } =
  await import("@tests/mocks/next-navigation");

function resetGuideStore() {
  useGuideStore.setState({
    activeGuideId: null,
    stepIndex: 0,
    entityId: null,
    status: "idle",
    completed: {},
  });
}

function withActiveWorkspace(organizationId = "org-1") {
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: {
      organizationId,
      branchId: "branch-1",
      academicYearId: "ay-2026",
    },
    status: "ready",
    reason: null,
  });
}

beforeEach(() => {
  resetRouterMock();
  setPathname("/app/branches");
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: null,
    selection: { organizationId: null, branchId: null, academicYearId: null },
    status: "idle",
    reason: null,
  });
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(branchesGuide);
});

describe("the create-link step", () => {
  it("shows its tooltip on the dashboard once the guide is running", async () => {
    server.use(
      http.get(`${API_BASE}/branches`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
    );
    withActiveWorkspace();
    useGuideStore.getState().start("branches");
    setPathname("/app/branches");

    render(
      <GuideProvider>
        <BranchDashboardScreen />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("Create your first branch"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });
});

describe("creating the branch", () => {
  it("captures the new id and advances past create-submit on success", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_BASE}/branches`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(branchDto(body)), {
          status: 201,
        });
      }),
    );
    withActiveWorkspace();
    useGuideStore.getState().start("branches");
    useGuideStore.getState().setStep(1);
    setPathname("/app/branches/new");

    render(
      <GuideProvider>
        <CreateBranchScreen />
      </GuideProvider>,
    );

    await user.type(
      await screen.findByLabelText("Branch name"),
      "Horizon High School — North Campus",
    );
    await user.type(screen.getByLabelText("Code"), "hhs-north");
    await user.type(
      screen.getByLabelText("Contact email"),
      "north.branch@horizon.edu",
    );
    await user.type(screen.getByLabelText("Contact phone"), "9876543210");
    await user.type(screen.getByLabelText("Address line 1"), "123 Lane");
    await user.type(screen.getByLabelText("City"), "Mumbai");
    await user.type(screen.getByLabelText("State"), "Maharashtra");
    await user.type(screen.getByLabelText("Country"), "India");
    await user.type(screen.getByLabelText("Postal code"), "400001");
    await user.click(screen.getByRole("button", { name: "Create branch" }));

    await waitFor(() => {
      expect(useGuideStore.getState().stepIndex).toBe(2);
    });
    expect(useGuideStore.getState().entityId).toBe("branch-1");
    expect(useGuideStore.getState().status).toBe("running");
  });
});

describe("the details-lifecycle-link step", () => {
  it("does not activate for a record other than the one the guide captured", async () => {
    server.use(
      http.get(`${API_BASE}/branches/:id`, () =>
        HttpResponse.json(
          successEnvelope(branchDto({ id: "branch-2", code: "other" })),
        ),
      ),
    );
    withActiveWorkspace();
    useGuideStore.getState().start("branches");
    useGuideStore.getState().setStep(1);
    setPathname("/app/branches/branch-2");

    render(
      <GuideProvider>
        <BranchDetailsScreen id="branch-2" />
      </GuideProvider>,
    );

    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByText("Check its operating status"),
    ).not.toBeInTheDocument();
    expect(useGuideStore.getState().stepIndex).toBe(1);
  });
});

describe("the lifecycle-overview step", () => {
  it("completes the guide on Next, without firing the real status toggle", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/branches/:id`, () =>
        HttpResponse.json(successEnvelope(branchDto({ id: "branch-1" }))),
      ),
    );
    withActiveWorkspace();
    useGuideStore.getState().start("branches");
    useGuideStore.getState().setStep(3, "branch-1");
    setPathname("/app/branches/branch-1/lifecycle");

    render(
      <GuideProvider>
        <BranchLifecycleScreen id="branch-1" />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("Two of four stages are reachable"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    expect(useGuideStore.getState().completed["branches"]).toEqual({
      version: 1,
      completedAt: expect.any(String),
    });
  });
});
