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
  AcademicUnitDashboardScreen,
  AcademicUnitDetailsScreen,
  CreateAcademicUnitScreen,
  academicUnitsGuide,
} from "@/features/academic-unit";
import { ProgramPicker } from "@/features/program";
import { toWorkspaceAvailability } from "@/features/workspace";

import { academicUnitDto } from "@tests/fixtures/academic-unit";
import { successEnvelope } from "@tests/fixtures/api";
import { programDto } from "@tests/fixtures/program";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

/**
 * The Academic Units reference guide, wired into its real screens.
 *
 * Requires **both** halves of scope (branch and academic year) — see
 * `AcademicUnitScopeGate` and `docs/academic-unit-module.md` — so every test
 * here sets a full scope; the missing-scope states are the module's own
 * concern and already covered by `academic-units.test.tsx`.
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

function withActiveScope() {
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: {
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: "ay-2026",
    },
    status: "ready",
    reason: null,
  });
}

/** The program picker, as the route composition supplies it. */
function picker() {
  return <ProgramPicker />;
}

beforeEach(() => {
  resetRouterMock();
  setPathname("/app/academic-units");
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: null,
    selection: { organizationId: null, branchId: null, academicYearId: null },
    status: "idle",
    reason: null,
  });
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(academicUnitsGuide);
});

describe("the create-link step", () => {
  it("shows its tooltip on the dashboard once the guide is running", async () => {
    server.use(
      http.get(`${API_BASE}/academic-units`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
    );
    withActiveScope();
    useGuideStore.getState().start("academic-units");
    setPathname("/app/academic-units");

    render(
      <GuideProvider>
        <AcademicUnitDashboardScreen />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("Create your first academic unit"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });
});

describe("creating the unit", () => {
  it("captures the new id and advances past create-submit on success", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([programDto()])),
      ),
      http.get(`${API_BASE}/academic-units`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
      http.post(`${API_BASE}/academic-units`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(academicUnitDto(body)), {
          status: 201,
        });
      }),
    );
    withActiveScope();
    useGuideStore.getState().start("academic-units");
    useGuideStore.getState().setStep(1);
    setPathname("/app/academic-units/new");

    render(
      <GuideProvider>
        <CreateAcademicUnitScreen programPicker={picker()} />
      </GuideProvider>,
    );

    await user.click(await screen.findByRole("combobox", { name: /program/i }));
    await user.click(
      await screen.findByRole("option", { name: /higher secondary science/i }),
    );
    await user.type(screen.getByLabelText(/^name$/i), "Std 1");
    await user.click(
      screen.getByRole("button", { name: /create unit/i }),
    );

    await waitFor(() => {
      expect(useGuideStore.getState().stepIndex).toBe(2);
    });
    expect(useGuideStore.getState().entityId).toBe("unit-1");
    expect(useGuideStore.getState().status).toBe("running");
  });
});

describe("the id-scoped step", () => {
  it("does not activate for a record other than the one the guide captured", async () => {
    server.use(
      http.get(`${API_BASE}/academic-units`, () =>
        HttpResponse.json(
          successEnvelope([academicUnitDto({ id: "unit-2" })]),
        ),
      ),
    );
    withActiveScope();
    useGuideStore.getState().start("academic-units");
    useGuideStore.getState().setStep(1, "unit-1");
    setPathname("/app/academic-units/unit-2");

    render(
      <GuideProvider>
        <AcademicUnitDetailsScreen id="unit-2" />
      </GuideProvider>,
    );

    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByText("That's the structure started"),
    ).not.toBeInTheDocument();
    expect(useGuideStore.getState().stepIndex).toBe(1);
  });

  it("completes the guide on Next once the pathname's id matches the captured entity", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/academic-units`, () =>
        HttpResponse.json(successEnvelope([academicUnitDto()])),
      ),
    );
    withActiveScope();
    useGuideStore.getState().start("academic-units");
    useGuideStore.getState().setStep(2, "unit-1");
    setPathname("/app/academic-units/unit-1");

    render(
      <GuideProvider>
        <AcademicUnitDetailsScreen id="unit-1" />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("That's the structure started"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    expect(useGuideStore.getState().completed["academic-units"]).toEqual({
      version: 1,
      completedAt: expect.any(String),
    });
  });
});
