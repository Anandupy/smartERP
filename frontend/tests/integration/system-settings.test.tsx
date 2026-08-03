import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import {
  GeneralSettingsScreen,
  MaintenanceSupportScreen,
  SystemSettingsScreen,
} from "@/features/system-settings";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { systemSettingsDto } from "@tests/fixtures/system-settings";
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
});

describe("System Settings overview", () => {
  it("shows the deployment's environment, version and maintenance state", async () => {
    server.use(
      http.get(`${API_BASE}/system-settings`, () =>
        HttpResponse.json(
          successEnvelope(
            systemSettingsDto({ environment: "PROD", version: "4.2.1" }),
          ),
        ),
      ),
    );

    render(<SystemSettingsScreen />);

    expect(await screen.findByText("Production")).toBeInTheDocument();
    expect(screen.getByText("4.2.1")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("reports maintenance mode when it is on", async () => {
    server.use(
      http.get(`${API_BASE}/system-settings`, () =>
        HttpResponse.json(
          successEnvelope(systemSettingsDto({ maintenanceMode: true })),
        ),
      ),
    );

    render(<SystemSettingsScreen />);

    expect(await screen.findByText("Active")).toBeInTheDocument();
  });

  it("marks the sections whose backend contract is missing", async () => {
    render(<SystemSettingsScreen />);

    const branding = await screen.findByRole("link", {
      name: /Branding & Identity/,
    });
    expect(within(branding).getByText("Backend Pending")).toBeInTheDocument();
  });

  it("offers initialization rather than an error when no settings exist", async () => {
    // A 404 here is the installation's "not set up yet" state, not a failure.
    server.use(
      http.get(`${API_BASE}/system-settings`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NotFoundException", message: "Not found" }),
          { status: 404 },
        ),
      ),
    );

    render(<SystemSettingsScreen />);

    expect(
      await screen.findByText("System settings are not initialized"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Initialize system settings/ }),
    ).toBeInTheDocument();
  });

  it("surfaces a genuine failure through the shared error state", async () => {
    server.use(
      http.get(`${API_BASE}/system-settings`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "InternalServerError", message: "Boom" }),
          { status: 500 },
        ),
      ),
    );

    render(<SystemSettingsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Something went wrong/,
    );
  });
});

describe("General Settings", () => {
  it("seeds the form from the loaded record", async () => {
    render(<GeneralSettingsScreen />);

    expect(await screen.findByLabelText("Product name")).toHaveValue(
      "CampusFlow ERP",
    );
    expect(screen.getByLabelText("Product code")).toHaveValue("CF-ERP");
  });

  it("keeps save disabled until something actually changes", async () => {
    const user = userEvent.setup();
    render(<GeneralSettingsScreen />);

    const save = await screen.findByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    await user.clear(screen.getByLabelText("Product name"));
    await user.type(screen.getByLabelText("Product name"), "Renamed ERP");

    expect(save).toBeEnabled();
  });

  it("sends a complete body, preserving the fields the other screen owns", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.get(`${API_BASE}/system-settings`, () =>
        HttpResponse.json(
          successEnvelope(
            systemSettingsDto({
              supportEmail: "help@campus.edu",
              maintenanceMessage: "Existing notice",
            }),
          ),
        ),
      ),
      http.patch(`${API_BASE}/system-settings`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(systemSettingsDto(body)));
      }),
    );

    render(<GeneralSettingsScreen />);

    await user.clear(await screen.findByLabelText("Version"));
    await user.type(screen.getByLabelText("Version"), "2.0.0");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      version: "2.0.0",
      supportEmail: "help@campus.edu",
      maintenanceMessage: "Existing notice",
    });
  });

  it("reports a rejected save inline instead of losing the edit", async () => {
    const user = userEvent.setup();

    server.use(
      http.patch(`${API_BASE}/system-settings`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "BadRequestException",
            message: "Product code already in use",
          }),
          { status: 400 },
        ),
      ),
    );

    render(<GeneralSettingsScreen />);

    await user.clear(await screen.findByLabelText("Product code"));
    await user.type(screen.getByLabelText("Product code"), "TAKEN");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Product code already in use"),
    ).toBeVisible();
    expect(screen.getByLabelText("Product code")).toHaveValue("TAKEN");
  });
});

describe("Maintenance & Support", () => {
  it("warns before an edit that would take the whole installation offline", async () => {
    const user = userEvent.setup();
    render(<MaintenanceSupportScreen />);

    const toggle = await screen.findByRole("switch", {
      name: /Put the system into maintenance/,
    });
    expect(screen.queryByText("This will affect everyone")).toBeNull();

    await user.click(toggle);

    expect(await screen.findByText("This will affect everyone")).toBeVisible();
  });

  it("sends a cleared message as null rather than an empty string", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.get(`${API_BASE}/system-settings`, () =>
        HttpResponse.json(
          successEnvelope(
            systemSettingsDto({ maintenanceMessage: "Old notice" }),
          ),
        ),
      ),
      http.patch(`${API_BASE}/system-settings`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(systemSettingsDto(body)));
      }),
    );

    render(<MaintenanceSupportScreen />);

    await user.clear(await screen.findByLabelText("Maintenance message"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.maintenanceMessage).toBeNull();
  });
});
