import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { GuideProvider, registerGuide } from "@/core/guides";
import { useGuideStore } from "@/core/guides/guide-store";
import { __resetGuideRegistryForTests } from "@/core/guides/registry";
import {
  CreateOrganizationScreen,
  OrganizationDashboardScreen,
  OrganizationDetailsScreen,
  organizationsGuide,
} from "@/features/organization";

import { organizationDto } from "@tests/fixtures/organization";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

/**
 * The Organizations reference guide, wired into its real screens.
 *
 * Second proof (after Academic Years) that the platform generalizes: this
 * guide has no id-scoped "activate" step at all — an organization is active
 * the moment it's created — so its last step is explanatory (§12's "Type B"),
 * advancing on the tooltip's own Next button rather than a real mutation.
 * That path is exactly what `academic-years-guide.test.tsx` does not cover,
 * which is why it gets its own spec rather than duplicating that file's
 * cross-route/entity-scoping coverage.
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

beforeEach(() => {
  resetRouterMock();
  setPathname("/app/organizations");
  resetGuideStore();
  __resetGuideRegistryForTests();
  registerGuide(organizationsGuide);
});

describe("the create-link step", () => {
  it("shows its tooltip on the dashboard once the guide is running", async () => {
    server.use(
      http.get(`${API_BASE}/organizations`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
    );
    useGuideStore.getState().start("organizations");
    setPathname("/app/organizations");

    render(
      <GuideProvider>
        <OrganizationDashboardScreen />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("Create your organization"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });
});

describe("creating the organization", () => {
  it("captures the new id and advances past create-submit on success", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_BASE}/organizations`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(organizationDto(body)), {
          status: 201,
        });
      }),
    );
    useGuideStore.getState().start("organizations");
    useGuideStore.getState().setStep(1);
    setPathname("/app/organizations/new");

    render(
      <GuideProvider>
        <CreateOrganizationScreen />
      </GuideProvider>,
    );

    await user.type(
      await screen.findByLabelText("Organization name"),
      "Horizon Education Trust",
    );
    await user.type(screen.getByLabelText("Code"), "horizon-trust");
    await user.type(
      screen.getByLabelText("Contact email"),
      "admin@horizon.edu",
    );
    await user.type(screen.getByLabelText("Contact phone"), "9876543210");
    await user.type(screen.getByLabelText("Address line 1"), "100 Towers");
    await user.type(screen.getByLabelText("City"), "Mumbai");
    await user.type(screen.getByLabelText("State"), "Maharashtra");
    await user.type(screen.getByLabelText("Country"), "India");
    await user.type(screen.getByLabelText("Postal code"), "400001");
    await user.type(screen.getByLabelText("Currency"), "INR");
    await user.type(screen.getByLabelText("Master expiry date"), "2030-12-31");
    await user.click(
      screen.getByRole("button", { name: "Create organization" }),
    );

    await waitFor(() => {
      expect(useGuideStore.getState().stepIndex).toBe(2);
    });
    expect(useGuideStore.getState().entityId).toBe("org-1");
    expect(useGuideStore.getState().status).toBe("running");
  });
});

describe("a rejected save", () => {
  it("leaves the guide on the create-submit step, never advancing on a failure", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_BASE}/organizations`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "ConflictException",
            message: "Code already in use",
          }),
          { status: 409 },
        ),
      ),
    );
    useGuideStore.getState().start("organizations");
    useGuideStore.getState().setStep(1);
    setPathname("/app/organizations/new");

    render(
      <GuideProvider>
        <CreateOrganizationScreen />
      </GuideProvider>,
    );

    await user.type(
      await screen.findByLabelText("Organization name"),
      "Horizon Education Trust",
    );
    await user.type(screen.getByLabelText("Code"), "horizon-trust");
    await user.type(
      screen.getByLabelText("Contact email"),
      "admin@horizon.edu",
    );
    await user.type(screen.getByLabelText("Contact phone"), "9876543210");
    await user.type(screen.getByLabelText("Address line 1"), "100 Towers");
    await user.type(screen.getByLabelText("City"), "Mumbai");
    await user.type(screen.getByLabelText("State"), "Maharashtra");
    await user.type(screen.getByLabelText("Country"), "India");
    await user.type(screen.getByLabelText("Postal code"), "400001");
    await user.type(screen.getByLabelText("Currency"), "INR");
    await user.type(screen.getByLabelText("Master expiry date"), "2030-12-31");
    await user.click(
      screen.getByRole("button", { name: "Create organization" }),
    );

    expect(await screen.findByText("Code already in use")).toBeInTheDocument();
    expect(useGuideStore.getState().stepIndex).toBe(1);
    expect(useGuideStore.getState().status).toBe("running");
    expect(useGuideStore.getState().entityId).toBeNull();
  });
});

describe("the details-overview step", () => {
  it("completes the guide on Next, without requiring any mutation", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_BASE}/organizations/:id`, () =>
        HttpResponse.json(successEnvelope(organizationDto())),
      ),
    );
    useGuideStore.getState().start("organizations");
    useGuideStore.getState().setStep(2, "org-1");
    setPathname("/app/organizations/org-1");

    render(
      <GuideProvider>
        <OrganizationDetailsScreen id="org-1" />
      </GuideProvider>,
    );

    expect(
      await screen.findByText("It's active immediately"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => {
      expect(useGuideStore.getState().status).toBe("completed");
    });
    expect(useGuideStore.getState().completed["organizations"]).toEqual({
      version: 1,
      completedAt: expect.any(String),
    });
  });
});
