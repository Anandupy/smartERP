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
  CreateNumberingConfigScreen,
  NumberingConfigListScreen,
  numberingGuide,
} from "@/features/numbering";
import { toWorkspaceAvailability } from "@/features/workspace";

import { successEnvelope } from "@tests/fixtures/api";
import { numberingConfigDto } from "@tests/fixtures/numbering";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");
const CONFIGS_PATH = `${API_BASE}/numbering/configs`;

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

beforeEach(() => {
  resetRouterMock();
  setPathname("/app/settings/numbering");
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: null,
    selection: { organizationId: null, branchId: null, academicYearId: null },
    status: "idle",
    reason: null,
  });
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(numberingGuide);
});

describe("the list-create-link step", () => {
  it("shows its tooltip on the numbering list once the guide is running", async () => {
    server.use(
      http.get(CONFIGS_PATH, () => HttpResponse.json(successEnvelope([]))),
    );
    withActiveScope();
    useGuideStore.getState().start("numbering");
    setPathname("/app/settings/numbering");

    render(
      <GuideProvider>
        <NumberingConfigListScreen />
      </GuideProvider>,
    );

    expect(await screen.findByText("Create a sequence")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
  });
});

describe("creating the sequence", () => {
  it("completes the guide on a successful save — there is no further route to continue to", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(CONFIGS_PATH, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope(numberingConfigDto(body as never)),
          { status: 201 },
        );
      }),
    );
    withActiveScope();
    useGuideStore.getState().start("numbering");
    useGuideStore.getState().setStep(1);
    setPathname("/app/settings/numbering/new");

    render(
      <GuideProvider>
        <CreateNumberingConfigScreen />
      </GuideProvider>,
    );

    expect(await screen.findByText("Save the sequence")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /^purpose$/i }));
    await user.click(
      await screen.findByRole("option", { name: /student code/i }),
    );
    // `format` keeps its valid default ("{prefix}{sequence}") — nothing else
    // needs filling in for this record type.
    await user.click(
      screen.getByRole("button", { name: /create sequence/i }),
    );

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    expect(useGuideStore.getState().completed["numbering"]).toEqual({
      version: 1,
      completedAt: expect.any(String),
    });
  });
});
