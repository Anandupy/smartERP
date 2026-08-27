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
  CreateProgramScreen,
  ProgramDashboardScreen,
  ProgramDetailsScreen,
  programsGuide,
} from "@/features/program";
import { toWorkspaceAvailability } from "@/features/workspace";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { programDto } from "@tests/fixtures/program";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

/**
 * The Programs reference guide, wired into its real screens.
 *
 * Same explanatory-last-step pattern as Organizations: a program is active
 * immediately, so the last step points at the real bridge to Academic
 * Units ("View the unit hierarchy") rather than a real mutation.
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

function withActiveWorkspace(branchId = "branch-1") {
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: {
      organizationId: "org-1",
      branchId,
      academicYearId: "ay-2026",
    },
    status: "ready",
    reason: null,
  });
}

beforeEach(() => {
  resetRouterMock();
  setPathname("/app/programs");
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: null,
    selection: { organizationId: null, branchId: null, academicYearId: null },
    status: "idle",
    reason: null,
  });
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(programsGuide);
});

describe("the create-link step", () => {
  it("shows its tooltip on the dashboard once the guide is running", async () => {
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
    );
    withActiveWorkspace();
    useGuideStore.getState().start("programs");
    setPathname("/app/programs");

    render(
      <GuideProvider>
        <ProgramDashboardScreen />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("Create your first program"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });
});

describe("creating the program", () => {
  it("captures the new id and advances past create-submit on success", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_BASE}/programs`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(programDto(body)), {
          status: 201,
        });
      }),
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
    );
    withActiveWorkspace();
    useGuideStore.getState().start("programs");
    useGuideStore.getState().setStep(1);
    setPathname("/app/programs/new");

    render(
      <GuideProvider>
        <CreateProgramScreen />
      </GuideProvider>,
    );

    await user.type(
      await screen.findByLabelText("Program name"),
      "Higher Secondary Science",
    );
    await user.click(
      screen.getByRole("button", { name: /create program/i }),
    );

    await waitFor(() => {
      expect(useGuideStore.getState().stepIndex).toBe(2);
    });
    expect(useGuideStore.getState().entityId).toBe("program-1");
    expect(useGuideStore.getState().status).toBe("running");
  });
});

describe("a rejected save", () => {
  it("leaves the guide on the create-submit step, never advancing on a failure", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_BASE}/programs`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "ConflictException",
            message: "A program with this combination already exists",
          }),
          { status: 409 },
        ),
      ),
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
    );
    withActiveWorkspace();
    useGuideStore.getState().start("programs");
    useGuideStore.getState().setStep(1);
    setPathname("/app/programs/new");

    render(
      <GuideProvider>
        <CreateProgramScreen />
      </GuideProvider>,
    );

    await user.type(
      await screen.findByLabelText("Program name"),
      "Higher Secondary Science",
    );
    await user.click(
      screen.getByRole("button", { name: /create program/i }),
    );

    expect(
      await screen.findByText(/already exists/i),
    ).toBeInTheDocument();
    expect(useGuideStore.getState().stepIndex).toBe(1);
    expect(useGuideStore.getState().status).toBe("running");
    expect(useGuideStore.getState().entityId).toBeNull();
  });
});

describe("the details-unit-hierarchy-link step", () => {
  it("completes the guide on Next, without requiring any mutation", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/programs/:id`, () =>
        HttpResponse.json(successEnvelope(programDto())),
      ),
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([programDto()])),
      ),
    );
    withActiveWorkspace();
    useGuideStore.getState().start("programs");
    useGuideStore.getState().setStep(2, "program-1");
    setPathname("/app/programs/program-1");

    render(
      <GuideProvider>
        <ProgramDetailsScreen id="program-1" />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("Now build the structure inside it"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    expect(useGuideStore.getState().completed["programs"]).toEqual({
      version: 1,
      completedAt: expect.any(String),
    });
  });
});
