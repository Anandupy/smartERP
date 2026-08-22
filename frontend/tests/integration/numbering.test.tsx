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
  CreateNumberingConfigScreen,
  EditNumberingConfigScreen,
  NumberingConfigListScreen,
} from "@/features/numbering";
import { toWorkspaceAvailability } from "@/features/workspace";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { numberingConfigDto, secondNumberingConfigDto } from "@tests/fixtures/numbering";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } = await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, routerMock } = await import("@tests/mocks/next-navigation");

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");
const CONFIGS_PATH = `${API_BASE}/numbering/configs`;

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

function withActiveWorkspace(branchId = "branch-1") {
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: { organizationId: "org-1", branchId, academicYearId: "ay-2026" },
    status: "ready",
    reason: null,
  });
}

function withConfigs(...configs: ReturnType<typeof numberingConfigDto>[]) {
  server.use(
    http.get(CONFIGS_PATH, () => HttpResponse.json(successEnvelope(configs))),
  );
}

describe("Numbering directory", () => {
  it("lists sequences with purpose, format and status", async () => {
    withActiveWorkspace();
    withConfigs(numberingConfigDto());

    render(<NumberingConfigListScreen />);

    expect(await screen.findByText("Student Code")).toBeInTheDocument();
    expect(screen.getByText("{prefix}{sequence}")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("narrows by search", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withConfigs(numberingConfigDto(), secondNumberingConfigDto());

    render(<NumberingConfigListScreen />);
    await screen.findByText("Admission Number");

    await user.type(
      screen.getByRole("searchbox", { name: /Search numbering sequences/i }),
      "Student",
    );

    await waitFor(() => expect(screen.queryByText("Admission Number")).toBeNull());
    expect(screen.getByText("Student Code")).toBeInTheDocument();
  });

  it("offers a way in when the directory is empty", async () => {
    withActiveWorkspace();
    withConfigs();

    render(<NumberingConfigListScreen />);

    expect(
      await screen.findByText("No numbering sequences configured"),
    ).toBeVisible();
  });

  it("renders a failed list through the shared error state", async () => {
    withActiveWorkspace();
    server.use(
      http.get(CONFIGS_PATH, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ForbiddenException", message: "No access" }),
          { status: 403 },
        ),
      ),
    );

    render(<NumberingConfigListScreen />);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("previews a sample without consuming a number", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withConfigs(numberingConfigDto());
    let previewCalled = false;

    server.use(
      http.post(`${CONFIGS_PATH}/:id/preview`, async ({ request }) => {
        previewCalled = true;
        const body = (await request.json()) as { sampleValue: number };
        return HttpResponse.json(
          successEnvelope({
            purpose: "STUDENT_CODE",
            sampleValue: body.sampleValue,
            rendered: "STU0000000123",
          }),
        );
      }),
    );

    render(<NumberingConfigListScreen />);

    await user.click(await screen.findByRole("button", { name: /Actions for/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Preview/ }));
    await user.click(screen.getByRole("button", { name: "Render preview" }));

    await waitFor(() => expect(previewCalled).toBe(true));
    expect(await screen.findByText("STU0000000123")).toBeInTheDocument();
  });
});

describe("Creating a sequence", () => {
  it("sends the documented Create body, without scope/allocationMode/resetStrategy/isActive", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(CONFIGS_PATH, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(numberingConfigDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateNumberingConfigScreen />);

    await user.click(await screen.findByRole("combobox", { name: "Purpose" }));
    await user.click(await screen.findByRole("option", { name: "Student Code" }));
    await user.clear(screen.getByLabelText("Prefix"));
    await user.type(screen.getByLabelText("Prefix"), "STU");
    await user.click(screen.getByRole("button", { name: "Create sequence" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      purpose: "STUDENT_CODE",
      prefix: "STU",
      format: "{prefix}{sequence}",
    });
    expect(body).not.toHaveProperty("scope");
    expect(body).not.toHaveProperty("allocationMode");
    expect(body).not.toHaveProperty("resetStrategy");
    expect(body).not.toHaveProperty("isActive");
  });

  it("does not render an Active toggle on create", async () => {
    withActiveWorkspace();
    render(<CreateNumberingConfigScreen />);

    await screen.findByRole("combobox", { name: "Purpose" });
    expect(screen.queryByText("Active", { selector: "label" })).not.toBeInTheDocument();
  });

  it("rejects a format missing {sequence}", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();

    render(<CreateNumberingConfigScreen />);

    await screen.findByRole("combobox", { name: "Purpose" });
    await user.clear(screen.getByLabelText("Format"));
    await user.type(screen.getByLabelText("Format"), "{prefix}-{year}");
    await user.click(screen.getByRole("button", { name: "Create sequence" }));

    expect(await screen.findByText("Format must include {sequence}")).toBeInTheDocument();
  });
});

describe("Editing a sequence", () => {
  it("seeds the form from the loaded record, purpose locked", async () => {
    withActiveWorkspace();
    withConfigs(numberingConfigDto());

    render(<EditNumberingConfigScreen id="config-1" />);

    expect(await screen.findByLabelText("Prefix")).toHaveValue("STU");
    expect(screen.getByRole("combobox", { name: "Purpose" })).toBeDisabled();
  });

  it("sends isActive in the Update body", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withConfigs(numberingConfigDto({ id: "config-9" }));
    let body: Record<string, unknown> | null = null;

    server.use(
      http.patch(`${CONFIGS_PATH}/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(numberingConfigDto({ ...body, id: "config-9" })));
      }),
    );

    render(<EditNumberingConfigScreen id="config-9" />);

    await user.click(await screen.findByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ isActive: true, prefix: "STU" });
  });

  it("returns to the directory once saved", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withConfigs(numberingConfigDto());

    render(<EditNumberingConfigScreen id="config-1" />);

    await user.click(await screen.findByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith("/app/settings/numbering"),
    );
  });

  it("treats a record absent from the list as not found", async () => {
    withActiveWorkspace();
    withConfigs(numberingConfigDto());

    render(<EditNumberingConfigScreen id="missing" />);

    expect(await screen.findByText("Sequence not found")).toBeVisible();
  });
});
