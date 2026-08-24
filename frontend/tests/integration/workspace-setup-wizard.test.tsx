import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { apiConfig } from "@/config";
import {
  createMemoryWorkspaceStorage,
  resetWorkspaceSelectionPolicy,
  setWorkspaceStorage,
  useWorkspaceStore,
  type WorkspaceAvailability,
  type WorkspaceSetupStatus,
} from "@/core/workspace";
import {
  SetupReviewScreen,
  SetupWelcomeScreen,
} from "@/features/workspace-setup";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

/**
 * These screens read progress from `core/workspace`'s store directly (the
 * same store `useWorkspaceBootstrap` publishes to from `/auth/me`), so tests
 * seed it the same way `workspace-store.test.ts` does rather than mocking a
 * second network round trip through identity.
 */
const ORGANIZATION = { id: "org-1", name: "Horizon Trust", code: "HT" };
const BRANCH = {
  id: "branch-1",
  name: "North Campus",
  code: "NC",
  organizationId: "org-1",
};

function availability(
  overrides: Partial<WorkspaceAvailability> = {},
): WorkspaceAvailability {
  return {
    organizations: [],
    branches: [],
    academicYears: [],
    defaults: { organizationId: null, branchId: null, academicYearId: null },
    role: "SUPER_ADMIN",
    ...overrides,
  };
}

function setupStatus(
  overrides: Partial<WorkspaceSetupStatus> = {},
): WorkspaceSetupStatus {
  return {
    setupRequired: true,
    setupStage: "SYSTEM_SETTINGS",
    missingResources: [
      "SYSTEM_SETTINGS",
      "ORGANIZATION",
      "BRANCH",
      "ACADEMIC_YEAR",
    ],
    completedResources: [],
    allowedActions: [],
    initializedAt: null,
    ...overrides,
  };
}

function seed(
  availabilityOverrides: Partial<WorkspaceAvailability>,
  setupOverrides: Partial<WorkspaceSetupStatus>,
) {
  useWorkspaceStore
    .getState()
    .setAvailability(availability(availabilityOverrides), setupStatus(setupOverrides));
}

beforeEach(() => {
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  resetWorkspaceSelectionPolicy();
  useWorkspaceStore.getState().clear();
});

describe("welcome screen: SUPER_ADMIN", () => {
  it("links to the next actionable step and shows the delegate panel", async () => {
    seed({}, {});
    render(<SetupWelcomeScreen role="SUPER_ADMIN" />);

    expect(
      await screen.findByRole("link", { name: /continue: system settings/i }),
    ).toHaveAttribute("href", "/setup/system-settings");
    expect(
      screen.getByText(/prefer to delegate this setup/i),
    ).toBeInTheDocument();
  });

  it("provisions an ORG_ADMIN through the existing user endpoint", async () => {
    seed({ organizations: [ORGANIZATION] }, {});
    server.use(
      http.post(`${API_BASE}/users`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toMatchObject({
          role: "ORG_ADMIN",
          organizationId: "org-1",
          // CreateUserDto.phone requires E.164 — the country-code field
          // defaults to +91 and the test only types the national number.
          phone: "+919876543210",
        });
        return HttpResponse.json(
          successEnvelope({
            id: "user-9",
            fullName: "Dana Kapoor",
            username: "dana_kapoor",
            email: "dana@institution.edu",
            role: "ORG_ADMIN",
          }),
          { status: 201 },
        );
      }),
    );

    render(<SetupWelcomeScreen role="SUPER_ADMIN" />);

    await userEvent.click(
      screen.getByRole("button", { name: /prefer to delegate this setup/i }),
    );
    await userEvent.type(
      screen.getByLabelText(/full name/i),
      "Dana Kapoor",
    );
    await userEvent.type(screen.getByLabelText(/^username/i), "dana_kapoor");
    await userEvent.type(
      screen.getByLabelText(/^email/i),
      "dana@institution.edu",
    );
    await userEvent.type(
      screen.getByLabelText(/phone number/i),
      "9876543210",
    );
    await userEvent.type(
      screen.getByLabelText(/temporary password/i),
      "Password123!",
    );

    await userEvent.click(
      screen.getByRole("combobox", { name: /organization/i }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /horizon trust/i }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /create administrator/i }),
    );

    expect(
      await screen.findByText(/administrator created/i),
    ).toBeInTheDocument();
  });

  it("rejects an invalid phone number before ever sending the request", async () => {
    // No POST /users handler is registered: MSW fails the test on any
    // unhandled request, so a request reaching the network here would fail
    // the test on its own — this proves client-side validation stopped it.
    seed({ organizations: [ORGANIZATION] }, {});
    render(<SetupWelcomeScreen role="SUPER_ADMIN" />);

    await userEvent.click(
      screen.getByRole("button", { name: /prefer to delegate this setup/i }),
    );
    await userEvent.type(screen.getByLabelText(/full name/i), "Dana Kapoor");
    await userEvent.type(screen.getByLabelText(/^username/i), "dana_kapoor");
    await userEvent.type(
      screen.getByLabelText(/^email/i),
      "dana@institution.edu",
    );
    await userEvent.type(screen.getByLabelText(/phone number/i), "12x45");
    await userEvent.type(
      screen.getByLabelText(/temporary password/i),
      "Password123!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create administrator/i }),
    );

    expect(
      await screen.findByText(/digits only/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/administrator created/i)).not.toBeInTheDocument();
  });

  it("rejects an empty phone number before ever sending the request", async () => {
    seed({ organizations: [ORGANIZATION] }, {});
    render(<SetupWelcomeScreen role="SUPER_ADMIN" />);

    await userEvent.click(
      screen.getByRole("button", { name: /prefer to delegate this setup/i }),
    );
    await userEvent.type(screen.getByLabelText(/full name/i), "Dana Kapoor");
    await userEvent.type(screen.getByLabelText(/^username/i), "dana_kapoor");
    await userEvent.type(
      screen.getByLabelText(/^email/i),
      "dana@institution.edu",
    );
    await userEvent.type(
      screen.getByLabelText(/temporary password/i),
      "Password123!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create administrator/i }),
    );

    // CreateUserDto.phone is @IsNotEmpty() — an absent number is exactly as
    // invalid as a malformed one, not a silently-allowed optional field.
    expect(await screen.findByText(/digits only/i)).toBeInTheDocument();
  });

  it("shows the backend's phone rejection as a friendly message, not the raw validator text", async () => {
    seed({ organizations: [ORGANIZATION] }, {});
    server.use(
      http.post(`${API_BASE}/users`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "BadRequestException",
            message: "phone must be a valid phone number",
            errors: [
              { field: "phone", message: "phone must be a valid phone number" },
            ],
          },
          { status: 400 },
        ),
      ),
    );

    render(<SetupWelcomeScreen role="SUPER_ADMIN" />);

    await userEvent.click(
      screen.getByRole("button", { name: /prefer to delegate this setup/i }),
    );
    await userEvent.type(screen.getByLabelText(/full name/i), "Dana Kapoor");
    await userEvent.type(screen.getByLabelText(/^username/i), "dana_kapoor");
    await userEvent.type(
      screen.getByLabelText(/^email/i),
      "dana@institution.edu",
    );
    // A shape the client-side check would accept but the backend still
    // refuses (e.g. a number libphonenumber cannot resolve to a real range).
    await userEvent.type(screen.getByLabelText(/phone number/i), "0000000");
    await userEvent.type(
      screen.getByLabelText(/temporary password/i),
      "Password123!",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create administrator/i }),
    );

    expect(
      await screen.findByText(
        /enter a valid phone number, including the country code/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/phone must be a valid phone number/i)).not
      .toBeInTheDocument();
  });
});

describe("welcome screen: ORG_ADMIN", () => {
  it("shows a waiting state when blocked on a SUPER_ADMIN-only step", async () => {
    seed({ role: "ORG_ADMIN" }, {});
    render(<SetupWelcomeScreen role="ORG_ADMIN" />);

    expect(
      await screen.findByText(/waiting on your platform administrator/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /continue/i }),
    ).not.toBeInTheDocument();
    // Organization delegation is a SUPER_ADMIN action.
    expect(
      screen.queryByText(/prefer to delegate this setup/i),
    ).not.toBeInTheDocument();
  });

  it("unblocks once the organization exists", async () => {
    seed(
      { role: "ORG_ADMIN", organizations: [ORGANIZATION] },
      {
        missingResources: ["BRANCH", "ACADEMIC_YEAR"],
        completedResources: ["SYSTEM_SETTINGS", "ORGANIZATION"],
      },
    );
    render(<SetupWelcomeScreen role="ORG_ADMIN" />);

    expect(
      await screen.findByRole("link", { name: /continue: branch/i }),
    ).toHaveAttribute("href", "/setup/branch");
  });
});

describe("review screen", () => {
  it("lets SUPER_ADMIN complete setup once everything is done", async () => {
    seed(
      { organizations: [ORGANIZATION], branches: [BRANCH] },
      {
        missingResources: [],
        completedResources: [
          "SYSTEM_SETTINGS",
          "ORGANIZATION",
          "BRANCH",
          "ACADEMIC_YEAR",
        ],
      },
    );
    server.use(
      http.post(`${API_BASE}/workspace/setup/complete`, () =>
        HttpResponse.json(successEnvelope({ setupRequired: false })),
      ),
    );

    let completed = false;
    render(
      <SetupReviewScreen role="SUPER_ADMIN" onCompleted={() => { completed = true; }} />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /complete setup/i }),
    );

    await waitFor(() => expect(completed).toBe(true));
  });

  it("lets a delegated ORG_ADMIN complete setup for their own organization", async () => {
    seed(
      { role: "ORG_ADMIN", organizations: [ORGANIZATION], branches: [BRANCH] },
      {
        missingResources: [],
        completedResources: [
          "SYSTEM_SETTINGS",
          "ORGANIZATION",
          "BRANCH",
          "ACADEMIC_YEAR",
        ],
      },
    );
    server.use(
      http.post(`${API_BASE}/workspace/setup/complete`, () =>
        HttpResponse.json(successEnvelope({ setupRequired: false })),
      ),
    );

    let completed = false;
    render(
      <SetupReviewScreen role="ORG_ADMIN" onCompleted={() => { completed = true; }} />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /complete setup/i }),
    );

    await waitFor(() => expect(completed).toBe(true));
  });

  it("shows the backend's refusal and stays on the screen for an ORG_ADMIN with no resolved organization", async () => {
    // The frontend cannot know this in advance — completedResources reads
    // ORGANIZATION as done globally, but this specific ORG_ADMIN's own
    // account is not (yet) scoped to one. The backend is authoritative: it
    // answers 403, and the screen must show that rather than pretend success.
    seed(
      { role: "ORG_ADMIN" },
      {
        missingResources: [],
        completedResources: [
          "SYSTEM_SETTINGS",
          "ORGANIZATION",
          "BRANCH",
          "ACADEMIC_YEAR",
        ],
      },
    );
    server.use(
      http.post(`${API_BASE}/workspace/setup/complete`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "ForbiddenException",
            message:
              "Completing setup requires an organization assigned to your account.",
          }),
          { status: 403 },
        ),
      ),
    );

    let completed = false;
    render(
      <SetupReviewScreen role="ORG_ADMIN" onCompleted={() => { completed = true; }} />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /complete setup/i }),
    );

    expect(
      await screen.findByText(/organization assigned to your account/i),
    ).toBeInTheDocument();
    expect(completed).toBe(false);
  });

  it("warns instead of offering completion while resources are missing", async () => {
    seed({}, {});
    render(<SetupReviewScreen role="SUPER_ADMIN" onCompleted={() => {}} />);

    expect(
      await screen.findByText(/required steps are still missing/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /complete setup/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the backend's own error and stays on the screen when completion is refused", async () => {
    seed(
      {},
      {
        missingResources: [],
        completedResources: [
          "SYSTEM_SETTINGS",
          "ORGANIZATION",
          "BRANCH",
          "ACADEMIC_YEAR",
        ],
      },
    );
    server.use(
      http.post(`${API_BASE}/workspace/setup/complete`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "ConflictException",
            message: "Workspace setup cannot be completed while resources are missing.",
          }),
          { status: 409 },
        ),
      ),
    );

    let completed = false;
    render(
      <SetupReviewScreen role="SUPER_ADMIN" onCompleted={() => { completed = true; }} />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /complete setup/i }),
    );

    expect(
      await screen.findByText(/cannot be completed while resources are missing/i),
    ).toBeInTheDocument();
    expect(completed).toBe(false);
  });
});
