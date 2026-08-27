import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { GuideHelpTrigger, GuideProvider, registerGuide } from "@/core/guides";
import { useGuideStore } from "@/core/guides/guide-store";
import { __resetGuideRegistryForTests } from "@/core/guides/registry";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import {
  academicYearsGuide,
  AcademicYearDashboardScreen,
  AcademicYearDetailsScreen,
  AcademicYearLifecycleScreen,
  CreateAcademicYearScreen,
} from "@/features/academic-year";
import { toWorkspaceAvailability } from "@/features/workspace";

import { upcomingAcademicYearDto } from "@tests/fixtures/academic-year";
import { successEnvelope } from "@tests/fixtures/api";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

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
      academicYearId: "ay-1",
    },
    status: "ready",
    reason: null,
  });
}

beforeEach(() => {
  resetRouterMock();
  setPathname("/app/academic-years");
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: null,
    selection: { organizationId: null, branchId: null, academicYearId: null },
    status: "idle",
    reason: null,
  });
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(academicYearsGuide);
});

describe("no active guide", () => {
  it("renders nothing extra when the guide has not been started", async () => {
    withActiveWorkspace();

    render(
      <GuideProvider>
        <AcademicYearDashboardScreen />
      </GuideProvider>,
    );

    await screen.findByRole("heading", { name: "Academic Years" });
    expect(
      screen.queryByText("Create your first academic year"),
    ).not.toBeInTheDocument();
  });
});

describe("the create-link step", () => {
  it("shows its tooltip on the dashboard once the guide is running", async () => {
    withActiveWorkspace();
    useGuideStore.getState().start("academic-years");
    setPathname("/app/academic-years");

    render(
      <GuideProvider>
        <AcademicYearDashboardScreen />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("Create your first academic year"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("shows nothing when the running step's route does not match the page", async () => {
    withActiveWorkspace();
    useGuideStore.getState().start("academic-years");
    setPathname("/app/branches");

    render(
      <GuideProvider>
        <AcademicYearDashboardScreen />
      </GuideProvider>,
    );

    await screen.findByRole("heading", { name: "Academic Years" });
    expect(
      screen.queryByText("Create your first academic year"),
    ).not.toBeInTheDocument();
  });
});

describe("navigating to the create page", () => {
  it("catches the guide up to the create-submit step automatically", async () => {
    withActiveWorkspace();
    useGuideStore.getState().start("academic-years");
    setPathname("/app/academic-years/new");

    render(
      <GuideProvider>
        <CreateAcademicYearScreen />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("Save the new year"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(useGuideStore.getState().stepIndex).toBe(1);
  });
});

describe("creating the year", () => {
  it("captures the new id and advances past create-submit on success", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(1);
    setPathname("/app/academic-years/new");

    render(
      <GuideProvider>
        <CreateAcademicYearScreen />
      </GuideProvider>,
    );

    await user.type(await screen.findByLabelText(/^name$/i), "2027-28");
    await user.type(screen.getByLabelText(/start date/i), "2027-04-01");
    await user.type(screen.getByLabelText(/end date/i), "2028-03-31");
    await user.click(
      screen.getByRole("button", { name: /create academic year/i }),
    );

    await waitFor(() => {
      expect(useGuideStore.getState().stepIndex).toBe(2);
    });
    expect(useGuideStore.getState().entityId).toEqual(expect.any(String));
    expect(useGuideStore.getState().status).toBe("running");
  });
});

describe("the id-scoped steps", () => {
  it("does not activate for a record other than the one the guide captured", async () => {
    withActiveWorkspace();
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(1);
    setPathname("/app/academic-years/ay-2");

    render(
      <GuideProvider>
        <AcademicYearDetailsScreen id="ay-2" />
      </GuideProvider>,
    );

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Now activate it")).not.toBeInTheDocument();
    expect(useGuideStore.getState().stepIndex).toBe(1);
  });

  it("does activate once the pathname's id matches the captured entity", async () => {
    withActiveWorkspace();
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(2, "ay-1");
    setPathname("/app/academic-years/ay-1");

    render(
      <GuideProvider>
        <AcademicYearDetailsScreen id="ay-1" />
      </GuideProvider>,
    );

    expect(await screen.findByText("Now activate it")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
  });
});

describe("activating the year", () => {
  it("completes the guide once the real activation succeeds", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    server.use(
      http.get(`${API_BASE}/academic-years`, () =>
        HttpResponse.json(successEnvelope([upcomingAcademicYearDto()])),
      ),
    );
    useGuideStore.getState().start("academic-years");
    useGuideStore.getState().setStep(3, "ay-3");
    setPathname("/app/academic-years/ay-3/lifecycle");

    render(
      <GuideProvider>
        <AcademicYearLifecycleScreen id="ay-3" />
      </GuideProvider>,
    );

    await screen.findByText(/lifecycle actions/i);
    await user.click(screen.getByRole("button", { name: /activate year/i }));
    const dialog = await screen.findByRole("alertdialog", {
      name: /activate year\?/i,
    });
    await user.click(
      within(dialog).getByRole("button", { name: /activate year/i }),
    );

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    expect(useGuideStore.getState().activeGuideId).toBeNull();
    expect(useGuideStore.getState().completed["academic-years"]).toEqual({
      version: 1,
      completedAt: expect.any(String),
    });
  });
});

describe("skipping", () => {
  it("ends the guide without marking it completed", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    useGuideStore.getState().start("academic-years");
    setPathname("/app/academic-years");

    render(
      <GuideProvider>
        <AcademicYearDashboardScreen />
      </GuideProvider>,
    );

    await screen.findByText("Create your first academic year");
    await user.click(screen.getByRole("button", { name: /skip guide/i }));

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("skipped");
    });
    expect(useGuideStore.getState().completed["academic-years"]).toBeUndefined();
  });
});

describe("the Help drawer trigger", () => {
  it("shows a discoverable Guide button and closes the drawer before starting the tour", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    setPathname("/app/academic-years");

    render(
      <GuideProvider>
        <GuideHelpTrigger guideId="academic-years" />
      </GuideProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: /guide for this page/i }),
    );
    const drawer = await screen.findByRole("dialog", {
      name: "Academic Years",
    });
    await user.click(
      within(drawer).getByRole("button", { name: /start guided tour/i }),
    );

    // The drawer must fully close — not merely appear to, behind the tour —
    // before the guide is considered started (docs/guides.md §7).
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Academic Years" }),
      ).not.toBeInTheDocument();
    });
    expect(useGuideStore.getState().activeGuideId).toBe("academic-years");
  });
});
