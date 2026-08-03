import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { ROUTES } from "@/constants";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import { toWorkspaceAvailability } from "@/features/workspace";
import {
  BranchAcademicSettingsScreen,
  BranchCommunicationSettingsScreen,
  BranchDashboardScreen,
  BranchDetailsScreen,
  BranchDirectoryScreen,
  BranchGeneralSettingsScreen,
  BranchLifecycleScreen,
  BranchSettingsDashboardScreen,
  CreateBranchScreen,
  EditBranchScreen,
} from "@/features/branch";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { branchDto, secondBranchDto } from "@tests/fixtures/branch";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock, routerMock } =
  await import("@tests/mocks/next-navigation");

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

/**
 * Put the app in a resolved workspace.
 *
 * The create form seeds its parent organization from `useWorkspace()`, so
 * without a scope it correctly refuses to submit — `organizationId` is a
 * required documented field. Specs that create a branch establish the same
 * starting point the app has after workspace selection.
 */
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

/** Replace the branch list for one test. */
function withBranches(...branches: ReturnType<typeof branchDto>[]) {
  server.use(
    http.get(`${API_BASE}/branches`, () =>
      HttpResponse.json(successEnvelope(branches)),
    ),
  );
}

/** Replace the single-branch response for one test. */
function withBranch(branch: ReturnType<typeof branchDto>) {
  server.use(
    http.get(`${API_BASE}/branches/:id`, () =>
      HttpResponse.json(successEnvelope(branch)),
    ),
  );
}

/** Body rows in render order. The first `row` is the header. */
function bodyRows() {
  return screen.getAllByRole("row").slice(1);
}

describe("Branch directory", () => {
  it("lists branches with identity, type, contact and status", async () => {
    withBranches(branchDto());

    render(<BranchDirectoryScreen />);

    await screen.findByText("Horizon High School — North Campus");
    const [row] = bodyRows();

    expect(within(row!).getByText("hhs-north")).toBeInTheDocument();
    expect(within(row!).getByText("School")).toBeInTheDocument();
    expect(
      within(row!).getByText("north.branch@horizon.edu"),
    ).toBeInTheDocument();
    expect(within(row!).getByText("Active")).toBeInTheDocument();
  });

  it("orders branches by name so the list is stable", async () => {
    withBranches(branchDto(), secondBranchDto());

    render(<BranchDirectoryScreen />);

    await screen.findByText("Avalon Institute — City Campus");
    expect(bodyRows()[0]).toHaveTextContent("Avalon Institute — City Campus");
  });

  it("narrows by search without sending a query the backend has not documented", async () => {
    const user = userEvent.setup();
    const requestUrls: string[] = [];

    server.use(
      http.get(`${API_BASE}/branches`, ({ request }) => {
        requestUrls.push(request.url);
        return HttpResponse.json(
          successEnvelope([branchDto(), secondBranchDto()]),
        );
      }),
    );

    render(<BranchDirectoryScreen />);
    await screen.findByText("Avalon Institute — City Campus");

    await user.type(
      screen.getByRole("searchbox", { name: "Search branches" }),
      "horizon",
    );

    await waitFor(() =>
      expect(screen.queryByText("Avalon Institute — City Campus")).toBeNull(),
    );

    for (const url of requestUrls) {
      expect(new URL(url).search).toBe("");
    }
  });

  it("narrows by institution type", async () => {
    const user = userEvent.setup();
    withBranches(branchDto(), secondBranchDto());

    render(<BranchDirectoryScreen />);
    await screen.findByText("Avalon Institute — City Campus");

    await user.click(screen.getByRole("combobox", { name: "Filter by type" }));
    await user.click(await screen.findByRole("option", { name: "School" }));

    await waitFor(() =>
      expect(screen.queryByText("Avalon Institute — City Campus")).toBeNull(),
    );
    expect(
      screen.getByText("Horizon High School — North Campus"),
    ).toBeInTheDocument();
  });

  it("says plainly that querying happens in the browser", async () => {
    render(<BranchDirectoryScreen />);

    expect(
      await screen.findByText(
        /searching, filtering, sorting and paging run in this browser/i,
      ),
    ).toBeInTheDocument();
  });

  it("explains why filtering to deleted returns nothing", async () => {
    const user = userEvent.setup();
    withBranches(branchDto());

    render(<BranchDirectoryScreen />);
    await screen.findByText("Horizon High School — North Campus");

    await user.click(
      screen.getByRole("combobox", { name: "Filter by status" }),
    );
    await user.click(await screen.findByRole("option", { name: "Deleted" }));

    expect(
      await screen.findByText("Deleted branches are not listed"),
    ).toBeVisible();
  });

  it("offers a way in when the directory is empty", async () => {
    withBranches();

    render(<BranchDirectoryScreen />);

    expect(await screen.findByText("No branches yet")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /Create branch/ }),
    ).not.toHaveLength(0);
  });

  it("renders a failed list through the shared error state", async () => {
    server.use(
      http.get(`${API_BASE}/branches`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ForbiddenException", message: "No access" }),
          { status: 403 },
        ),
      ),
    );

    render(<BranchDirectoryScreen />);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("shows an unreported status as unknown rather than inactive", async () => {
    withBranches(branchDto({ isActive: undefined, isDeleted: undefined }));

    render(<BranchDirectoryScreen />);

    await screen.findByText("Horizon High School — North Campus");
    expect(within(bodyRows()[0]!).getByText("Unknown")).toBeInTheDocument();
  });
});

describe("Branch status toggle", () => {
  it("names the resulting state before firing the non-idempotent toggle", async () => {
    const user = userEvent.setup();
    withBranches(branchDto({ isActive: true }));

    render(<BranchDirectoryScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Horizon/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Deactivate branch/ }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Deactivate branch\?/);
    expect(dialog).toHaveTextContent(/can be reactivated/i);
  });

  it("sends a PATCH with no body, as the recorded request has none", async () => {
    const user = userEvent.setup();
    let bodyText: string | null = null;

    withBranches(branchDto({ id: "branch-9", isActive: true }));
    server.use(
      http.patch(`${API_BASE}/branches/:id/status`, async ({ request }) => {
        bodyText = await request.text();
        return HttpResponse.json(successEnvelope(branchDto()));
      }),
    );

    render(<BranchDirectoryScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Horizon/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Deactivate branch/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Deactivate branch" }),
    );

    await waitFor(() => expect(bodyText).not.toBeNull());
    expect(bodyText).toBe("");
  });

  it("offers no toggle when the current state is unknown", async () => {
    const user = userEvent.setup();
    withBranches(branchDto({ isActive: undefined, isDeleted: undefined }));

    render(<BranchDirectoryScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Horizon/ }),
    );

    expect(await screen.findByRole("menuitem", { name: /Edit/ })).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: /ctivate branch/ }),
    ).toBeNull();
  });
});

describe("Deleting a branch", () => {
  it("describes the soft delete accurately", async () => {
    const user = userEvent.setup();
    withBranches(branchDto());

    render(<BranchDirectoryScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Horizon/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Delete branch/ }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/record is retained/i);
    expect(dialog).toHaveTextContent(/no endpoint to restore/i);
  });

  it("calls DELETE only after confirmation", async () => {
    const user = userEvent.setup();
    let deleted: string | null = null;

    withBranches(branchDto({ id: "branch-9" }));
    server.use(
      http.delete(`${API_BASE}/branches/:id`, ({ params }) => {
        deleted = String(params.id);
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<BranchDirectoryScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Horizon/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Delete branch/ }),
    );
    expect(deleted).toBeNull();

    await user.click(
      await screen.findByRole("button", { name: "Delete branch" }),
    );

    await waitFor(() => expect(deleted).toBe("branch-9"));
  });
});

describe("Branch dashboard", () => {
  it("counts what the endpoint returned, not a platform total", async () => {
    render(<BranchDashboardScreen />);

    expect(await screen.findByText("Listed")).toBeInTheDocument();
    expect(
      screen.getByText("Returned by the branches endpoint"),
    ).toBeInTheDocument();
  });

  it("declares that uptime and enrolment figures have no source", async () => {
    render(<BranchDashboardScreen />);

    expect(
      await screen.findByText(/Uptime, latency and node health have no/i),
    ).toBeInTheDocument();
  });

  it("breaks the returned branches down by institution type", async () => {
    withBranches(branchDto(), secondBranchDto());

    render(<BranchDashboardScreen />);

    expect(await screen.findByText("By institution type")).toBeVisible();
    expect(screen.getByText("Degree college")).toBeInTheDocument();
  });
});

describe("Branch details", () => {
  it("shows every documented field and nothing else", async () => {
    render(<BranchDetailsScreen id="branch-1" />);

    expect(
      await screen.findByRole("heading", { name: /Horizon High School/ }),
    ).toBeVisible();
    expect(screen.getByText("hhs-north")).toBeInTheDocument();
    expect(screen.getByText("REG-001")).toBeInTheDocument();
    expect(screen.getByText("CBSE · BOARD")).toBeInTheDocument();

    // Fields the design shows but the contract has no room for.
    expect(screen.queryByText(/Total Students/i)).toBeNull();
    expect(screen.queryByText(/Faculty Members/i)).toBeNull();
  });

  it("explains the structure mode from the documentation", async () => {
    withBranch(branchDto({ structureMode: "CUSTOM" }));

    render(<BranchDetailsScreen id="branch-1" />);

    expect(
      await screen.findByText(/defined manually by the Program module/i),
    ).toBeVisible();
  });

  it("treats a missing branch as an empty state, not a failure", async () => {
    server.use(
      http.get(`${API_BASE}/branches/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NotFoundException", message: "Not found" }),
          { status: 404 },
        ),
      ),
    );

    render(<BranchDetailsScreen id="missing" />);

    expect(await screen.findByText("Branch not found")).toBeVisible();
  });

  it("reports a refused branch as a permission boundary", async () => {
    server.use(
      http.get(`${API_BASE}/branches/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ForbiddenException", message: "Nope" }),
          { status: 403 },
        ),
      ),
    );

    render(<BranchDetailsScreen id="branch-1" />);

    expect(
      await screen.findByText(/does not have access to this branch/i),
    ).toBeVisible();
  });
});

describe("Creating a branch", () => {
  it("sends exactly the documented fields", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API_BASE}/branches`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(branchDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateBranchScreen />);

    await user.type(
      await screen.findByLabelText("Branch name"),
      "North Campus",
    );
    await user.type(screen.getByLabelText("Code"), "north-campus");
    await user.type(screen.getByLabelText("Contact email"), "n@horizon.edu");
    await user.type(screen.getByLabelText("Contact phone"), "9876543210");
    await user.type(screen.getByLabelText("Address line 1"), "123 Lane");
    await user.type(screen.getByLabelText("City"), "Mumbai");
    await user.type(screen.getByLabelText("State"), "Maharashtra");
    await user.type(screen.getByLabelText("Country"), "India");
    await user.type(screen.getByLabelText("Postal code"), "400001");

    // The workspace fixture supplies the parent organization.
    await user.click(screen.getByRole("button", { name: "Create branch" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      name: "North Campus",
      code: "north-campus",
      institutionType: "SCHOOL",
      structureMode: "DEFAULT",
    });
    expect(body).not.toHaveProperty("isActive");
    expect(body).not.toHaveProperty("isDeleted");
    expect(body!.registrationNumber).toBeNull();
    expect(body!.affiliationType).toBeNull();
  });

  it("rejects a code that is not slug-safe", async () => {
    const user = userEvent.setup();
    render(<CreateBranchScreen />);

    await user.type(await screen.findByLabelText("Code"), "North Campus");
    await user.click(screen.getByRole("button", { name: "Create branch" }));

    expect(
      await screen.findByText(
        "Lowercase letters, numbers and single hyphens only",
      ),
    ).toBeVisible();
  });

  it("asks for the affiliating body once a type is chosen", async () => {
    const user = userEvent.setup();
    render(<CreateBranchScreen />);

    await user.click(
      await screen.findByRole("combobox", { name: /Affiliation/ }),
    );
    await user.click(await screen.findByRole("option", { name: "Board" }));

    expect(await screen.findByLabelText("Affiliating body")).toBeVisible();
  });

  it("reports a rejected save inline instead of losing the edit", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();

    server.use(
      http.post(`${API_BASE}/branches`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "ConflictException",
            message: "Code already in use",
          }),
          { status: 409 },
        ),
      ),
    );

    render(<CreateBranchScreen />);

    await user.type(await screen.findByLabelText("Branch name"), "North");
    await user.type(screen.getByLabelText("Code"), "taken");
    await user.type(screen.getByLabelText("Contact email"), "a@b.com");
    await user.type(screen.getByLabelText("Contact phone"), "1");
    await user.type(screen.getByLabelText("Address line 1"), "1");
    await user.type(screen.getByLabelText("City"), "1");
    await user.type(screen.getByLabelText("State"), "1");
    await user.type(screen.getByLabelText("Country"), "1");
    await user.type(screen.getByLabelText("Postal code"), "1");

    await user.click(screen.getByRole("button", { name: "Create branch" }));

    expect(await screen.findByText("Code already in use")).toBeVisible();
    expect(screen.getByLabelText("Code")).toHaveValue("taken");
  });
});

describe("Editing a branch", () => {
  it("seeds the form from the loaded record", async () => {
    render(<EditBranchScreen id="branch-1" />);

    expect(await screen.findByLabelText("Branch name")).toHaveValue(
      "Horizon High School — North Campus",
    );
    expect(screen.getByLabelText("Code")).toHaveValue("hhs-north");
  });

  it("locks the parent organization, since moving a branch is a migration", async () => {
    render(<EditBranchScreen id="branch-1" />);

    expect(
      await screen.findByRole("combobox", { name: /Parent organization/ }),
    ).toBeDisabled();
  });

  it("resends the complete documented body", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.patch(`${API_BASE}/branches/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(branchDto(body)));
      }),
    );

    render(<EditBranchScreen id="branch-1" />);

    await user.clear(await screen.findByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Pune");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      city: "Pune",
      name: "Horizon High School — North Campus",
      code: "hhs-north",
      institutionType: "SCHOOL",
    });
    expect(body).not.toHaveProperty("isActive");
  });

  it("returns to the detail screen once saved", async () => {
    const user = userEvent.setup();
    render(<EditBranchScreen id="branch-1" />);

    await user.clear(await screen.findByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Pune");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        ROUTES.app.branches.detail("branch-1"),
      ),
    );
  });
});

describe("Branch lifecycle", () => {
  it("renders every stage the design asks for", async () => {
    render(<BranchLifecycleScreen id="branch-1" />);

    await screen.findByRole("heading", { level: 3, name: "Archived" });

    for (const stage of [
      "Active",
      "Inactive",
      "Archived",
      "Deleted",
      "Permanent deletion",
    ]) {
      expect(
        screen.getByRole("heading", { level: 3, name: stage }),
      ).toBeVisible();
    }
  });

  it("reports three of five stages as reachable", async () => {
    render(<BranchLifecycleScreen id="branch-1" />);

    expect(await screen.findByText("3 of 5 reachable")).toBeVisible();
  });

  it("marks archiving and permanent deletion as pending", async () => {
    render(<BranchLifecycleScreen id="branch-1" />);

    await screen.findByRole("heading", { level: 3, name: "Archived" });
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeDisabled();
  });

  it("enables the documented toggle and delete", async () => {
    render(<BranchLifecycleScreen id="branch-1" />);

    expect(
      await screen.findByRole("button", { name: /Deactivate branch/ }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /^Delete branch$/ }),
    ).toBeEnabled();
  });

  it("withholds the toggle entirely when the status was not reported", async () => {
    withBranch(branchDto({ isActive: undefined, isDeleted: undefined }));

    render(<BranchLifecycleScreen id="branch-1" />);

    expect(
      await screen.findByText("The current status was not reported"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Unavailable/ })).toBeDisabled();
  });

  it("does not offer deletion for an already deleted branch", async () => {
    withBranch(branchDto({ isDeleted: true }));

    render(<BranchLifecycleScreen id="branch-1" />);

    expect(
      await screen.findByRole("button", { name: /Already deleted/ }),
    ).toBeDisabled();
  });
});

describe("Branch settings", () => {
  it("says outright that branch settings have no backend module", async () => {
    render(<BranchSettingsDashboardScreen id="branch-1" />);

    expect(
      await screen.findByText("Branch settings have no backend module"),
    ).toBeVisible();
  });

  it("marks the four sections without a contract, and not the fifth", async () => {
    render(<BranchSettingsDashboardScreen id="branch-1" />);

    const history = await screen.findByRole("link", {
      name: /History & Audit/,
    });
    expect(within(history).queryByText("Backend Pending")).toBeNull();

    const general = screen.getByRole("link", { name: /General/ });
    expect(within(general).getByText("Backend Pending")).toBeInTheDocument();
  });

  it("renders real, disabled controls rather than empty placeholders", async () => {
    render(<BranchGeneralSettingsScreen id="branch-1" />);

    const displayName = await screen.findByLabelText("Display name");
    expect(displayName).toBeDisabled();
    expect(screen.getByLabelText("Time zone")).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: "Save changes" })[0],
    ).toBeDisabled();
  });

  it("points at the branch record for the fields that are editable", async () => {
    render(<BranchGeneralSettingsScreen id="branch-1" />);

    expect(
      await screen.findByText(/Looking for name, code, contact or address\?/i),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Edit branch/ })).toHaveAttribute(
      "href",
      ROUTES.app.branches.edit("branch-1"),
    );
  });

  it("notes that structure mode is real while the rest of academic is not", async () => {
    render(<BranchAcademicSettingsScreen id="branch-1" />);

    expect(await screen.findByText("Structure mode is editable")).toBeVisible();
    expect(screen.getByText(/no grading contract exists/i)).toBeVisible();
  });

  it("explains that the communication module has no branch-scoped settings", async () => {
    render(<BranchCommunicationSettingsScreen id="branch-1" />);

    expect(
      await screen.findByText(/no branch-scoped variant is documented/i),
    ).toBeVisible();
  });
});
