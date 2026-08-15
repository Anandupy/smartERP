import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import {
  CommunicationAnalyticsScreen,
  CommunicationSettingsScreen,
  CreateTemplateScreen,
  DeliveryLogsScreen,
  EditTemplateScreen,
  SendNotificationScreen,
  TemplateDetailsScreen,
  TemplatesDirectoryScreen,
} from "@/features/communication";
import { toWorkspaceAvailability } from "@/features/workspace";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import {
  communicationSettingsDto,
  deliveryLogDto,
  templateDto,
} from "@tests/fixtures/communication";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock } = await import("@tests/mocks/next-navigation");

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

beforeEach(() => {
  resetRouterMock();
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: null,
    selection: { organizationId: null, branchId: null, academicYearId: null },
    status: "idle",
    reason: null,
  });
});

function withActiveWorkspace() {
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

function bodyRows() {
  return screen.getAllByRole("row").slice(1);
}

/**
 * A mutable capture cell for the request body/URL an MSW handler observed.
 *
 * Using an object property rather than a reassigned `let` sidesteps a
 * TypeScript control-flow quirk where a `let` mutated only inside a nested
 * closure gets narrowed to `never` at a later optional-chained read.
 */
function captureCell<T>(): { value: T | null } {
  return { value: null };
}

describe("Templates Directory", () => {
  it("lists templates with channel, category, scope and status", async () => {
    render(<TemplatesDirectoryScreen />);

    await waitFor(() => expect(bodyRows()).toHaveLength(2));

    expect(
      screen.getByText("Password Reset Request Email"),
    ).toBeInTheDocument();
    expect(screen.getByText("Welcome SMS")).toBeInTheDocument();
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("sends the documented filters to the server", async () => {
    const lastUrl = captureCell<URL>();
    server.use(
      http.get(`${API_BASE}/communication/templates`, ({ request }) => {
        lastUrl.value = new URL(request.url);
        return HttpResponse.json(successEnvelope([templateDto()]));
      }),
    );

    const user = userEvent.setup();
    render(<TemplatesDirectoryScreen />);
    await waitFor(() => expect(bodyRows()).toHaveLength(1));

    await user.type(screen.getByLabelText("Search templates"), "reset");

    await waitFor(() => {
      expect(lastUrl.value?.searchParams.get("search")).toBe("reset");
    });
  });

  it("shows an empty state when no templates exist", async () => {
    server.use(
      http.get(`${API_BASE}/communication/templates`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
    );

    render(<TemplatesDirectoryScreen />);

    expect(await screen.findByText("No templates yet")).toBeInTheDocument();
  });
});

describe("Create Template", () => {
  it("validates required fields before submitting", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    render(<CreateTemplateScreen />);

    await user.click(screen.getByRole("button", { name: /create template/i }));

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
  });

  it("submits the workspace's organization/branch and version 1", async () => {
    withActiveWorkspace();
    const lastBody = captureCell<Record<string, unknown>>();
    server.use(
      http.post(`${API_BASE}/communication/templates`, async ({ request }) => {
        lastBody.value = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(templateDto(lastBody.value)), {
          status: 201,
        });
      }),
    );

    const user = userEvent.setup();
    render(<CreateTemplateScreen />);

    await user.type(screen.getByLabelText("Code"), "WELCOME_EMAIL");
    await user.type(screen.getByLabelText("Name"), "Welcome Email");
    await user.click(screen.getByRole("button", { name: /create template/i }));

    await waitFor(() => expect(lastBody.value).not.toBeNull());
    expect(lastBody.value?.organizationId).toBe("org-1");
    expect(lastBody.value?.branchId).toBe("branch-1");
    expect(lastBody.value?.version).toBe(1);
    expect(lastBody.value?.status).toBe("DRAFT");
  });

  it("shows the no-scope state without an active branch", () => {
    render(<CreateTemplateScreen />);
    expect(screen.getByText("No active branch")).toBeInTheDocument();
  });
});

describe("Edit Template", () => {
  it("loads the record and preserves its scope and version on save", async () => {
    withActiveWorkspace();
    server.use(
      http.get(`${API_BASE}/communication/templates/:id`, () =>
        HttpResponse.json(
          successEnvelope(
            templateDto({
              organizationId: "org-9",
              branchId: null,
              version: 3,
            }),
          ),
        ),
      ),
    );

    const lastBody = captureCell<Record<string, unknown>>();
    server.use(
      http.patch(
        `${API_BASE}/communication/templates/:id`,
        async ({ request }) => {
          lastBody.value = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(successEnvelope(templateDto(lastBody.value)));
        },
      ),
    );

    const user = userEvent.setup();
    render(<EditTemplateScreen id="template-1" />);

    expect(
      await screen.findByDisplayValue("PASSWORD_RESET"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(lastBody.value).not.toBeNull());
    expect(lastBody.value?.organizationId).toBe("org-9");
    expect(lastBody.value?.branchId).toBeNull();
    expect(lastBody.value?.version).toBe(3);
  });

  it("opens the preview drawer and renders the backend's output", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    render(<EditTemplateScreen id="template-1" />);

    expect(
      await screen.findByDisplayValue("PASSWORD_RESET"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^preview$/i }));

    const drawer = await screen.findByRole("dialog");
    await user.click(
      within(drawer).getByRole("button", { name: /render preview/i }),
    );

    expect(
      await within(drawer).findByText("Reset Your Password"),
    ).toBeInTheDocument();
    expect(within(drawer).getByText(/missing variables/i)).toBeInTheDocument();
  });
});

describe("Template Details", () => {
  it("shows the template's stored content and scope", async () => {
    render(<TemplateDetailsScreen id="template-1" />);

    expect(
      await screen.findByRole("heading", {
        name: /password reset request email/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Branch-specific")).toBeInTheDocument();
  });

  it("renders the ApiErrorState on a failed fetch", async () => {
    server.use(
      http.get(`${API_BASE}/communication/templates/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NOT_FOUND", message: "Template not found" }),
          { status: 404 },
        ),
      ),
    );

    render(<TemplateDetailsScreen id="missing" />);
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});

describe("Delivery Logs", () => {
  it("lists logs with channel and status", async () => {
    withActiveWorkspace();
    render(<DeliveryLogsScreen />);

    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(screen.getByText("student@example.com")).toBeInTheDocument();
    expect(screen.getByText("parent@example.com")).toBeInTheDocument();
  });

  it("sends the active scope and filters as documented query parameters", async () => {
    withActiveWorkspace();
    const lastUrl = captureCell<URL>();
    server.use(
      http.get(`${API_BASE}/communication/delivery-logs`, ({ request }) => {
        lastUrl.value = new URL(request.url);
        return HttpResponse.json(
          successEnvelope([deliveryLogDto()], {
            meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
          }),
        );
      }),
    );

    render(<DeliveryLogsScreen />);
    await waitFor(() => expect(lastUrl.value).not.toBeNull());

    expect(lastUrl.value?.searchParams.get("organizationId")).toBe("org-1");
    expect(lastUrl.value?.searchParams.get("branchId")).toBe("branch-1");
  });

  it("opens the detail drawer from the row already loaded, with no second fetch", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    render(<DeliveryLogsScreen />);

    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    await user.click(screen.getByText("parent@example.com"));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("PROVIDER_TIMEOUT")).toBeInTheDocument();
  });

  it("shows the no-scope state without an active branch", () => {
    render(<DeliveryLogsScreen />);
    expect(screen.getByText("No active branch")).toBeInTheDocument();
  });
});

describe("Communication Analytics", () => {
  it("renders the six documented counters, never fabricating a metric", async () => {
    withActiveWorkspace();
    render(<CommunicationAnalyticsScreen />);

    expect(await screen.findAllByText("100")).toHaveLength(2); // Total and Sent
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText(/time-series/i)).toBeInTheDocument();
  });
});

describe("Communication Settings", () => {
  it("loads current settings and toggles a channel off", async () => {
    withActiveWorkspace();
    const lastBody = captureCell<Record<string, unknown>>();
    server.use(
      http.patch(`${API_BASE}/communication/settings`, async ({ request }) => {
        lastBody.value = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope(communicationSettingsDto(lastBody.value)),
        );
      }),
    );

    const user = userEvent.setup();
    render(<CommunicationSettingsScreen />);

    const smsSwitch = await screen.findByRole("switch", { name: /^sms$/i });
    expect(smsSwitch).toBeChecked();

    await user.click(smsSwitch);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(lastBody.value).not.toBeNull());
    expect(lastBody.value?.smsEnabled).toBe(false);
    expect(lastBody.value?.emailEnabled).toBe(true);
  });

  it("shows the normalized server error on a failed save", async () => {
    withActiveWorkspace();
    server.use(
      http.patch(`${API_BASE}/communication/settings`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "SERVER_ERROR",
            message: "Could not save settings",
          }),
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<CommunicationSettingsScreen />);

    const emailSwitch = await screen.findByRole("switch", { name: /^email$/i });
    await user.click(emailSwitch);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText("Could not save settings"),
    ).toBeInTheDocument();
  });
});

describe("Send Notification", () => {
  it("validates required fields", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    render(<SendNotificationScreen />);

    await user.click(
      screen.getByRole("button", { name: /send notification/i }),
    );
    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
  });

  it("sends the documented single-recipient DTO", async () => {
    withActiveWorkspace();
    const lastBody = captureCell<Record<string, unknown>>();
    server.use(
      http.post(
        `${API_BASE}/communication/notifications`,
        async ({ request }) => {
          lastBody.value = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            successEnvelope({ id: "notification-9", ...lastBody.value }),
            { status: 201 },
          );
        },
      ),
    );

    const user = userEvent.setup();
    render(<SendNotificationScreen />);

    await user.type(screen.getByLabelText("User id"), "user-42");
    await user.type(screen.getByLabelText("Title"), "Fee due");
    await user.type(
      screen.getByLabelText("Content"),
      "Your fee is due tomorrow.",
    );
    await user.click(
      screen.getByRole("button", { name: /send notification/i }),
    );

    await waitFor(() => expect(lastBody.value).not.toBeNull());
    expect(lastBody.value?.userId).toBe("user-42");
    expect(lastBody.value?.organizationId).toBe("org-1");
    expect(lastBody.value?.branchId).toBe("branch-1");
    expect(lastBody.value?.isPinned).toBe(false);
  });

  it("states plainly that this is a single in-app recipient, not a broadcast", () => {
    withActiveWorkspace();
    render(<SendNotificationScreen />);
    expect(
      screen.getByText(/no broadcast, campaign or multi-channel/i),
    ).toBeInTheDocument();
  });
});
