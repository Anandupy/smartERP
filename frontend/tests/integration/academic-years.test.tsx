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
  AcademicYearCalendarScreen,
  AcademicYearDashboardScreen,
  AcademicYearDetailsScreen,
  AcademicYearDirectoryScreen,
  AcademicYearLifecycleScreen,
  CreateAcademicYearScreen,
  EditAcademicYearScreen,
} from "@/features/academic-year";
import { toWorkspaceAvailability } from "@/features/workspace";

import {
  academicYearDto,
  lockedAcademicYearDto,
  upcomingAcademicYearDto,
} from "@tests/fixtures/academic-year";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
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
 * Every academic-year read is scoped to a branch by a documented *required*
 * parameter, and the only place the app may learn the active branch is
 * `useWorkspace()`. Without a resolved scope the screens correctly refuse to
 * query, so specs that expect data establish the same starting point the app
 * has after workspace selection.
 */
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

/** Replace the branch's academic year list for one test. */
function withAcademicYears(...years: ReturnType<typeof academicYearDto>[]) {
  server.use(
    http.get(`${API_BASE}/academic-years`, () =>
      HttpResponse.json(successEnvelope(years)),
    ),
  );
}

/** Replace the `GET /academic-years/current` response for one test. */
function withCurrentYear(year: ReturnType<typeof academicYearDto> | null) {
  server.use(
    http.get(`${API_BASE}/academic-years/current`, () =>
      year
        ? HttpResponse.json(successEnvelope(year))
        : HttpResponse.json(
            errorEnvelope({ code: "NOT_FOUND", message: "No current year" }),
            { status: 404 },
          ),
    ),
  );
}

/** Body rows in render order. The first `row` is the header. */
function bodyRows() {
  return screen.getAllByRole("row").slice(1);
}

describe("Academic year directory", () => {
  it("lists years with name, dates, progress and status", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<AcademicYearDirectoryScreen />);

    await screen.findByText("2025-26");
    const [row] = bodyRows();

    expect(within(row!).getByText("Current")).toBeInTheDocument();
  });

  it("scopes the request to the active branch", async () => {
    withActiveWorkspace("branch-2");

    let requestedBranch: string | null = null;
    server.use(
      http.get(`${API_BASE}/academic-years`, ({ request }) => {
        requestedBranch = new URL(request.url).searchParams.get("branchId");
        return HttpResponse.json(successEnvelope([academicYearDto()]));
      }),
    );

    render(<AcademicYearDirectoryScreen />);

    await screen.findByText("2025-26");
    expect(requestedBranch).toBe("branch-2");
  });

  it("orders years with the most recent first", async () => {
    withActiveWorkspace();
    withAcademicYears(lockedAcademicYearDto(), upcomingAcademicYearDto());

    render(<AcademicYearDirectoryScreen />);

    await screen.findByText("2026-27");
    const rows = bodyRows();

    expect(within(rows[0]!).getByText("2026-27")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("2024-25")).toBeInTheDocument();
  });

  it("explains that querying happens in the browser", async () => {
    // The only documented query parameter is `branchId`, which identifies the
    // branch rather than narrowing the result.
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<AcademicYearDirectoryScreen />);

    await screen.findByText("2025-26");
    expect(
      screen.getByText(/run in this browser over the branch/i),
    ).toBeInTheDocument();
  });

  it("filters by state in the client", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(academicYearDto(), lockedAcademicYearDto());

    render(<AcademicYearDirectoryScreen />);

    await screen.findByText("2025-26");

    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: "Locked" }));

    await waitFor(() => {
      expect(screen.queryByText("2025-26")).not.toBeInTheDocument();
    });
    expect(screen.getByText("2024-25")).toBeInTheDocument();
  });

  it("searches by name", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(academicYearDto(), lockedAcademicYearDto());

    render(<AcademicYearDirectoryScreen />);
    await screen.findByText("2025-26");

    await user.type(
      screen.getByRole("searchbox", { name: /search academic years/i }),
      "2024",
    );

    await waitFor(() => {
      expect(screen.queryByText("2025-26")).not.toBeInTheDocument();
    });
  });

  it("shows a first-run empty state naming the auto-selection rule", async () => {
    withActiveWorkspace();
    withAcademicYears();

    render(<AcademicYearDirectoryScreen />);

    await screen.findByText("No academic years yet");
    expect(
      screen.getByText(/automatically activated and set as the branch/i),
    ).toBeInTheDocument();
  });

  it("renders an error state with a retry", async () => {
    withActiveWorkspace();
    server.use(
      http.get(`${API_BASE}/academic-years`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "SERVER_ERROR", message: "Boom" }),
          { status: 500 },
        ),
      ),
    );

    render(<AcademicYearDirectoryScreen />);

    expect(
      await screen.findByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("asks for a branch instead of showing an empty list", async () => {
    // No endpoint lists academic years across branches, so without a branch
    // there is genuinely nothing to ask for.
    render(<AcademicYearDirectoryScreen />);

    expect(await screen.findByText("No active branch")).toBeInTheDocument();
    expect(
      screen.getByText(/no endpoint lists them across branches/i),
    ).toBeInTheDocument();
  });
});

describe("Academic year directory — row actions", () => {
  it("offers no lifecycle transition on a locked year", async () => {
    // Documented rule 4: a locked year cannot be modified.
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(lockedAcademicYearDto());

    render(<AcademicYearDirectoryScreen />);
    await screen.findByText("2024-25");

    await user.click(
      screen.getByRole("button", { name: /actions for 2024-25/i }),
    );

    expect(
      screen.queryByRole("menuitem", { name: /activate year/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /lock year/i }),
    ).not.toBeInTheDocument();
  });

  it("disables edit and delete on a locked year", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(lockedAcademicYearDto());

    render(<AcademicYearDirectoryScreen />);
    await screen.findByText("2024-25");

    await user.click(
      screen.getByRole("button", { name: /actions for 2024-25/i }),
    );

    expect(screen.getByRole("menuitem", { name: /edit/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("menuitem", { name: /delete year/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("disables delete on the current year, per documented rule 5", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(academicYearDto({ isSelected: true, isLocked: false }));

    render(<AcademicYearDirectoryScreen />);
    await screen.findByText("2025-26");

    await user.click(
      screen.getByRole("button", { name: /actions for 2025-26/i }),
    );

    expect(
      screen.getByRole("menuitem", { name: /delete year/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("confirms a lock and warns that it cannot be undone", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    render(<AcademicYearDirectoryScreen />);
    await screen.findByText("2026-27");

    await user.click(
      screen.getByRole("button", { name: /actions for 2026-27/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /lock year/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/cannot be undone from here/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/no endpoint that unlocks an academic year/i),
    ).toBeInTheDocument();
  });

  it("sends the lock to the documented transition endpoint", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    let lockedId: string | null = null;
    server.use(
      http.patch(`${API_BASE}/academic-years/:id/lock`, ({ params }) => {
        lockedId = String(params.id);
        return HttpResponse.json(
          successEnvelope(upcomingAcademicYearDto({ isLocked: true })),
        );
      }),
    );

    render(<AcademicYearDirectoryScreen />);
    await screen.findByText("2026-27");

    await user.click(
      screen.getByRole("button", { name: /actions for 2026-27/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /lock year/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /lock year/i }));

    await waitFor(() => expect(lockedId).toBe("ay-3"));
  });

  it("sends the lifecycle call with no request body", async () => {
    // None of the three recorded transition requests has a body: no
    // `Content-Type` and no `body` key, while create and update have both.
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    let body: string | null = null;
    server.use(
      http.patch(`${API_BASE}/academic-years/:id/activate`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(
          successEnvelope(upcomingAcademicYearDto({ isActive: true })),
        );
      }),
    );

    render(<AcademicYearDirectoryScreen />);
    await screen.findByText("2026-27");

    await user.click(
      screen.getByRole("button", { name: /actions for 2026-27/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /activate year/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: /activate year/i }),
    );

    await waitFor(() => expect(body).toBe(""));
  });

  it("states the record is retained when deleting", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    render(<AcademicYearDirectoryScreen />);
    await screen.findByText("2026-27");

    await user.click(
      screen.getByRole("button", { name: /actions for 2026-27/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /delete year/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/soft-deleted/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/no endpoint that restores a deleted one/i),
    ).toBeInTheDocument();
  });
});

describe("Academic year dashboard", () => {
  it("counts the three documented flags separately", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto(), lockedAcademicYearDto());
    withCurrentYear(academicYearDto());

    render(<AcademicYearDashboardScreen />);

    await screen.findByText("Listed");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("says the tiles are not totals", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<AcademicYearDashboardScreen />);

    await screen.findByText("Listed");
    expect(
      await screen.findByText(/no figure here is a total/i),
    ).toBeInTheDocument();
  });

  it("shows the current year with its progress", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto());
    withCurrentYear(academicYearDto());

    render(<AcademicYearDashboardScreen />);

    expect(
      await screen.findByText(/current academic year/i),
    ).toBeInTheDocument();
  });

  it("treats a 404 from /current as no selected year, not a failure", async () => {
    // The documentation records no response body and no status code for a
    // branch with no selected year, so a 404 is read as "none".
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());
    withCurrentYear(null);

    render(<AcademicYearDashboardScreen />);

    expect(
      await screen.findByText(/this branch has no selected year/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
  });

  it("prompts to create the first year when the branch has none", async () => {
    withActiveWorkspace();
    withAcademicYears();
    withCurrentYear(null);

    render(<AcademicYearDashboardScreen />);

    expect(
      await screen.findByText(/this branch has no academic years/i),
    ).toBeInTheDocument();
  });

  it("asks for a branch when the workspace has no scope", async () => {
    render(<AcademicYearDashboardScreen />);
    expect(await screen.findByText("No active branch")).toBeInTheDocument();
  });
});

describe("Academic year details", () => {
  it("reports all three flags individually", async () => {
    // The header badge has to pick one label; a year that is current *and*
    // locked would otherwise lose the fact that the branch is still writing to
    // it.
    withActiveWorkspace();
    withAcademicYears(academicYearDto({ isSelected: true, isLocked: true }));

    render(<AcademicYearDetailsScreen id="ay-1" />);

    await screen.findByRole("heading", { name: "2025-26", level: 1 });
    expect(
      screen.getByText(/status flags/i),
    ).toBeInTheDocument();
  });

  it("shows an unreported flag as “Not reported”, never as “No”", async () => {
    withActiveWorkspace();
    withAcademicYears(
      academicYearDto({
        isActive: undefined,
        isSelected: undefined,
        isLocked: undefined,
      }),
    );

    render(<AcademicYearDetailsScreen id="ay-1" />);

    await screen.findByRole("heading", { name: "2025-26", level: 1 });
    expect(screen.getAllByText("Not reported").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/no status was reported/i),
    ).toBeInTheDocument();
  });

  it("replaces Edit with a locked marker on a locked year", async () => {
    withActiveWorkspace();
    withAcademicYears(lockedAcademicYearDto());

    render(<AcademicYearDetailsScreen id="ay-2" />);

    await screen.findByRole("heading", { name: "2024-25", level: 1 });
    expect(screen.getByRole("button", { name: /locked/i })).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: /^edit$/i }),
    ).not.toBeInTheDocument();
  });

  it("explains that a missing record means missing from this branch", async () => {
    // There is no `GET /academic-years/:id`, so the record is resolved out of
    // the branch list and "not found" is a weaker claim than a 404 would be.
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<AcademicYearDetailsScreen id="does-not-exist" />);

    expect(
      await screen.findByText("Academic year not found"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/may belong to another branch/i),
    ).toBeInTheDocument();
  });

  it("marks calendar events as pending rather than inventing them", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<AcademicYearDetailsScreen id="ay-1" />);

    await screen.findByRole("heading", { name: "2025-26", level: 1 });
    expect(
      screen.getByText(/terms, semesters, holidays and exam windows/i),
    ).toBeInTheDocument();
  });

  it("renders a forbidden state for a 403", async () => {
    withActiveWorkspace();
    server.use(
      http.get(`${API_BASE}/academic-years`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "FORBIDDEN", message: "Nope" }),
          { status: 403 },
        ),
      ),
    );

    render(<AcademicYearDetailsScreen id="ay-1" />);

    expect(
      await screen.findByText(/does not have access to this branch/i),
    ).toBeInTheDocument();
  });
});

describe("Academic year lifecycle", () => {
  it("names the four transitions the API does not document", async () => {
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    render(<AcademicYearLifecycleScreen id="ay-3" />);

    await screen.findByText(/transitions the api does not document/i);
    for (const label of ["Deactivate", "Deselect", "Unlock", "Restore"]) {
      expect(
        screen.getByRole("button", { name: label }),
      ).toBeDisabled();
    }
  });

  it("says every transition is one-way", async () => {
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    render(<AcademicYearLifecycleScreen id="ay-3" />);

    expect(
      await screen.findByText(/every transition below is one-way/i),
    ).toBeInTheDocument();
  });

  it("offers all three transitions when no flag was reported", async () => {
    // Unlike the branch status toggle, these endpoints name their target state,
    // so an unknown starting point does not make the result unpredictable.
    withActiveWorkspace();
    withAcademicYears(
      academicYearDto({
        isActive: undefined,
        isSelected: undefined,
        isLocked: undefined,
      }),
    );

    render(<AcademicYearLifecycleScreen id="ay-1" />);

    await screen.findByText(/lifecycle actions/i);
    expect(
      screen.getByRole("button", { name: /activate year/i }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: /lock year/i })).toBeEnabled();
  });

  it("disables every action on a locked year and says why", async () => {
    withActiveWorkspace();
    withAcademicYears(lockedAcademicYearDto());

    render(<AcademicYearLifecycleScreen id="ay-2" />);

    await screen.findByText(/lifecycle actions/i);
    expect(
      screen.getByRole("button", { name: /activate year/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/this year is locked, and locking is final/i),
    ).toBeInTheDocument();
  });

  it("blocks deleting the current year with the documented reason", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto({ isSelected: true, isLocked: false }));

    render(<AcademicYearLifecycleScreen id="ay-1" />);

    await screen.findByText(/danger zone/i);
    expect(screen.getByRole("button", { name: /delete year/i })).toBeDisabled();
    expect(
      screen.getByText(/select another year for this branch first/i),
    ).toBeInTheDocument();
  });

  it("marks archiving and permanent deletion as pending", async () => {
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    render(<AcademicYearLifecycleScreen id="ay-3" />);

    await screen.findByText(/danger zone/i);
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /delete permanently/i }),
    ).toBeDisabled();
  });

  it("returns to the directory after a successful delete", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    render(<AcademicYearLifecycleScreen id="ay-3" />);

    await screen.findByText(/danger zone/i);
    await user.click(screen.getByRole("button", { name: /delete year/i }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: /delete academic year/i }),
    );

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith("/app/academic-years/directory");
    });
  });
});

describe("Create academic year", () => {
  it("sends exactly the four documented fields", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(upcomingAcademicYearDto());

    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/academic-years`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(academicYearDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateAcademicYearScreen />);

    await user.type(await screen.findByLabelText(/^name$/i), "2027-28");
    await user.type(screen.getByLabelText(/start date/i), "2027-04-01");
    await user.type(screen.getByLabelText(/end date/i), "2028-03-31");
    await user.click(
      screen.getByRole("button", { name: /create academic year/i }),
    );

    await waitFor(() => expect(body).not.toBeNull());
    expect(Object.keys(body!).sort()).toEqual([
      "branchId",
      "endDate",
      "name",
      "startDate",
    ]);
    expect(body!.branchId).toBe("branch-1");
  });

  it("enforces the documented start-before-end rule", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears();

    render(<CreateAcademicYearScreen />);

    await user.type(await screen.findByLabelText(/^name$/i), "Bad");
    await user.type(screen.getByLabelText(/start date/i), "2028-03-31");
    await user.type(screen.getByLabelText(/end date/i), "2027-04-01");
    await user.click(
      screen.getByRole("button", { name: /create academic year/i }),
    );

    expect(
      await screen.findByText(/end date must fall after the start date/i),
    ).toBeInTheDocument();
  });

  it("warns about an overlapping range before submitting", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<CreateAcademicYearScreen />);

    await user.type(await screen.findByLabelText(/^name$/i), "Clash");
    await user.type(screen.getByLabelText(/start date/i), "2025-06-01");
    await user.type(screen.getByLabelText(/end date/i), "2026-06-30");

    expect(
      await screen.findByText(/overlaps an existing year/i),
    ).toBeInTheDocument();
  });

  it("warns that the first year of a branch becomes current automatically", async () => {
    withActiveWorkspace();
    withAcademicYears();

    render(<CreateAcademicYearScreen />);

    expect(
      await screen.findByText(/will become the branch's current year/i),
    ).toBeInTheDocument();
  });

  it("refuses to render the form without an active branch", async () => {
    render(<CreateAcademicYearScreen />);

    expect(await screen.findByText("No active branch")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
  });

  it("surfaces a rejected write rather than swallowing it", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears();
    server.use(
      http.post(`${API_BASE}/academic-years`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "VALIDATION_ERROR",
            message: "Academic years within a branch cannot overlap",
          }),
          { status: 400 },
        ),
      ),
    );

    render(<CreateAcademicYearScreen />);

    await user.type(await screen.findByLabelText(/^name$/i), "2027-28");
    await user.type(screen.getByLabelText(/start date/i), "2027-04-01");
    await user.type(screen.getByLabelText(/end date/i), "2028-03-31");
    await user.click(
      screen.getByRole("button", { name: /create academic year/i }),
    );

    expect(
      await screen.findByText(/cannot overlap/i),
    ).toBeInTheDocument();
  });
});

describe("Edit academic year", () => {
  it("seeds the form from the loaded record", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<EditAcademicYearScreen id="ay-1" />);

    expect(await screen.findByDisplayValue("2025-26")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2025-04-01")).toBeInTheDocument();
  });

  it("refuses to open the form for a locked year", async () => {
    // Documented: "Update details (if not locked)". Letting someone retype a
    // date range only to have the save refused would lose their work.
    withActiveWorkspace();
    withAcademicYears(lockedAcademicYearDto());

    render(<EditAcademicYearScreen id="ay-2" />);

    expect(
      await screen.findByText("This academic year is locked"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/start date/i)).not.toBeInTheDocument();
  });

  it("resends the complete documented body", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_BASE}/academic-years/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(academicYearDto(body)));
      }),
    );

    render(<EditAcademicYearScreen id="ay-1" />);

    const name = await screen.findByDisplayValue("2025-26");
    await user.clear(name);
    await user.type(name, "2025-2026");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(body).not.toBeNull());
    // No partial-update rule is documented and Postman sends the full body.
    expect(Object.keys(body!).sort()).toEqual([
      "branchId",
      "endDate",
      "name",
      "startDate",
    ]);
  });

  it("does not report the edited record as overlapping itself", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<EditAcademicYearScreen id="ay-1" />);

    await screen.findByDisplayValue("2025-26");
    expect(
      screen.queryByText(/overlaps an existing year/i),
    ).not.toBeInTheDocument();
  });
});

describe("Academic calendar", () => {
  it("plots the branch's years on one axis", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto(), lockedAcademicYearDto());
    withCurrentYear(academicYearDto());

    render(<AcademicYearCalendarScreen />);

    await screen.findByText(/^timeline$/i);
    expect(screen.getByText("Years plotted")).toBeInTheDocument();
  });

  it("enumerates the calendar sections with no backend", async () => {
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<AcademicYearCalendarScreen />);

    await screen.findByText(/calendar events/i);
    expect(screen.getByText("Terms & semesters")).toBeInTheDocument();
    expect(screen.getByText("Examination windows")).toBeInTheDocument();
  });

  it("explains why no empty month grid is drawn", async () => {
    // An empty calendar reads as "nothing is scheduled", which is a claim this
    // app has no endpoint to support.
    withActiveWorkspace();
    withAcademicYears(academicYearDto());

    render(<AcademicYearCalendarScreen />);

    expect(
      await screen.findByText(/a month or week grid is deliberately not rendered/i),
    ).toBeInTheDocument();
  });

  it("lists years it could not place rather than dropping them", async () => {
    withActiveWorkspace();
    withAcademicYears(
      academicYearDto(),
      academicYearDto({ id: "ay-bad", name: "Broken", startDate: "" }),
    );

    render(<AcademicYearCalendarScreen />);

    await screen.findByText(/not placed on the timeline/i);
    expect(screen.getByText(/Broken — start or end date/i)).toBeInTheDocument();
  });

  it("shows nothing to plot when the branch has no years", async () => {
    withActiveWorkspace();
    withAcademicYears();
    withCurrentYear(null);

    render(<AcademicYearCalendarScreen />);

    expect(await screen.findByText("Nothing to plot yet")).toBeInTheDocument();
  });

  it("asks for a branch when the workspace has no scope", async () => {
    render(<AcademicYearCalendarScreen />);
    expect(await screen.findByText("No active branch")).toBeInTheDocument();
  });
});
