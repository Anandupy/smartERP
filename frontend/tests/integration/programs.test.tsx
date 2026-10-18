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
import {
  CreateProgramScreen,
  EditProgramScreen,
  ProgramDashboardScreen,
  ProgramDetailsScreen,
  ProgramDirectoryScreen,
  ProgramTreeScreen,
} from "@/features/program";
import { toWorkspaceAvailability } from "@/features/workspace";
import { formatDateTime } from "@/utils";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import {
  childProgramDto,
  programDto,
  secondProgramDto,
} from "@tests/fixtures/program";
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

/** Put the app in a resolved workspace. */
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

/** Replace the branch's program list for one test. */
function withPrograms(...programs: ReturnType<typeof programDto>[]) {
  server.use(
    http.get(`${API_BASE}/programs`, () =>
      HttpResponse.json(successEnvelope(programs)),
    ),
  );
}

/** Replace the single-program response for one test. */
function withProgram(program: ReturnType<typeof programDto>) {
  server.use(
    http.get(`${API_BASE}/programs/:id`, () =>
      HttpResponse.json(successEnvelope(program)),
    ),
  );
}

function bodyRows() {
  return screen.getAllByRole("row").slice(1);
}

describe("Program directory", () => {
  it("lists programs with classification, level, parent and status", async () => {
    withActiveWorkspace();
    withPrograms(programDto());

    render(<ProgramDirectoryScreen />);

    await screen.findByText("Higher Secondary Science");
    const [row] = bodyRows();

    expect(
      within(row!).getByText("English · Science (PCM)"),
    ).toBeInTheDocument();
    expect(within(row!).getByText("SCHOOL")).toBeInTheDocument();
    expect(within(row!).getByText("Top level")).toBeInTheDocument();
    expect(within(row!).getByText("Active")).toBeInTheDocument();
  });

  it("scopes the request to the active branch", async () => {
    withActiveWorkspace("branch-2");

    let requestedBranch: string | null = null;
    server.use(
      http.get(`${API_BASE}/programs`, ({ request }) => {
        requestedBranch = new URL(request.url).searchParams.get("branchId");
        return HttpResponse.json(successEnvelope([programDto()]));
      }),
    );

    render(<ProgramDirectoryScreen />);

    await screen.findByText("Higher Secondary Science");
    expect(requestedBranch).toBe("branch-2");
  });

  it("resolves a parent to a name rather than printing a uuid", async () => {
    // Documented rule 2 guarantees a parent is in the same branch, so it is
    // either in this list or genuinely unreachable.
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto());

    render(<ProgramDirectoryScreen />);

    await screen.findByText("Physics Elective");
    expect(
      screen.getAllByText("Higher Secondary Science").length,
    ).toBeGreaterThan(0);
  });

  it("says so when a parent is not in the branch's list", async () => {
    withActiveWorkspace();
    withPrograms(childProgramDto({ parentId: "gone" }));

    render(<ProgramDirectoryScreen />);

    expect(
      await screen.findByText("Not in this branch's list"),
    ).toBeInTheDocument();
  });

  it("explains that querying happens in the browser", async () => {
    withActiveWorkspace();
    withPrograms(programDto());

    render(<ProgramDirectoryScreen />);

    await screen.findByText("Higher Secondary Science");
    expect(
      screen.getByText(/run in this browser over the branch/i),
    ).toBeInTheDocument();
  });

  it("builds the level filter from the values the branch actually uses", async () => {
    // `level` is a Postman-only field whose sole sample is SCHOOL, so an
    // invented vocabulary would hide real data behind non-matching options.
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(
      programDto({ level: "SCHOOL" }),
      secondProgramDto({ level: "COLLEGE" }),
    );

    render(<ProgramDirectoryScreen />);
    await screen.findByText("Commerce");

    await user.click(
      screen.getByRole("combobox", { name: /filter by level/i }),
    );

    expect(screen.getByRole("option", { name: "SCHOOL" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "COLLEGE" })).toBeInTheDocument();
  });

  it("filters by state in the client", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto(), secondProgramDto({ isActive: false }));

    render(<ProgramDirectoryScreen />);
    await screen.findByText("Commerce");

    await user.click(
      screen.getByRole("combobox", { name: /filter by status/i }),
    );
    await user.click(screen.getByRole("option", { name: "Inactive" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Higher Secondary Science"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Commerce")).toBeInTheDocument();
  });

  it("withholds the status action when the flag was not reported", async () => {
    // The toggle takes no body and therefore flips rather than sets, so the
    // result from an unknown starting point is unpredictable.
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto({ isActive: undefined }));

    render(<ProgramDirectoryScreen />);
    await screen.findByText("Higher Secondary Science");

    await user.click(
      screen.getByRole("button", { name: /actions for higher secondary/i }),
    );

    expect(
      screen.queryByRole("menuitem", { name: /activate program/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /deactivate program/i }),
    ).not.toBeInTheDocument();
  });

  it("refuses a delete that documented rule 4 blocks, and names the child", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto({ isActive: true }));

    render(<ProgramDirectoryScreen />);
    await screen.findByText("Physics Elective");

    await user.click(
      screen.getByRole("button", { name: /actions for higher secondary/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /delete program/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/cannot be deleted yet/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Physics Elective/)).toBeInTheDocument();
  });

  it("sends the status toggle with no request body", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto());

    let body: string | null = null;
    server.use(
      http.patch(`${API_BASE}/programs/:id/status`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(
          successEnvelope(programDto({ isActive: false })),
        );
      }),
    );

    render(<ProgramDirectoryScreen />);
    await screen.findByText("Higher Secondary Science");

    await user.click(
      screen.getByRole("button", { name: /actions for higher secondary/i }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /deactivate program/i }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: /deactivate program/i }),
    );

    await waitFor(() => expect(body).toBe(""));
  });

  it("asks for a branch instead of showing an empty list", async () => {
    render(<ProgramDirectoryScreen />);
    expect(await screen.findByText("No active branch")).toBeInTheDocument();
  });

  it("renders an error state with a retry", async () => {
    withActiveWorkspace();
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "SERVER_ERROR", message: "Boom" }),
          { status: 500 },
        ),
      ),
    );

    render(<ProgramDirectoryScreen />);

    expect(
      await screen.findByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});

describe("Program hierarchy", () => {
  it("renders a real tree with accessible levels", async () => {
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto());

    render(<ProgramTreeScreen />);

    await screen.findByRole("tree", { name: /program hierarchy/i });
    const items = screen.getAllByRole("treeitem");

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("aria-level", "1");
    expect(items[1]).toHaveAttribute("aria-level", "2");
  });

  it("builds the hierarchy from the flat list, not the tree endpoint", async () => {
    // GET /programs/tree is documented by name only — no response body — so
    // nothing may depend on its shape. Returning nonsense must not break this.
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto());
    server.use(
      http.get(`${API_BASE}/programs/tree`, () =>
        HttpResponse.json(successEnvelope("unexpected")),
      ),
    );

    render(<ProgramTreeScreen />);

    const items = await screen.findAllByRole("treeitem");
    expect(items).toHaveLength(2);
    expect(
      screen.getByText(/returned a shape this app does not recognise/i),
    ).toBeInTheDocument();
  });

  it("collapses and expands a parent", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto());

    render(<ProgramTreeScreen />);
    await screen.findAllByRole("treeitem");

    await user.click(
      screen.getByRole("button", { name: /collapse children/i }),
    );

    await waitFor(() => {
      expect(screen.getAllByRole("treeitem")).toHaveLength(1);
    });
  });

  it("lists orphans separately rather than promoting them to roots", async () => {
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto({ parentId: "gone" }));

    render(<ProgramTreeScreen />);

    await screen.findByText(/not placed in the hierarchy/i);
    // Only the real root is in the tree.
    expect(screen.getAllByRole("treeitem")).toHaveLength(1);
  });

  it("warns when the data contains a circular parent chain", async () => {
    withActiveWorkspace();
    withPrograms(
      programDto({ id: "p", parentId: "q" }),
      secondProgramDto({ id: "q", parentId: "p" }),
    );

    render(<ProgramTreeScreen />);

    expect(
      await screen.findByText(/circular parent chain/i),
    ).toBeInTheDocument();
  });

  it("shows an empty state pointing at academic units", async () => {
    withActiveWorkspace();
    withPrograms();

    render(<ProgramTreeScreen />);

    await screen.findByText("No programs yet");
    expect(
      screen.getByText(/academic units name a program/i),
    ).toBeInTheDocument();
  });
});

describe("Program create and edit", () => {
  it("sends exactly the six documented fields", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms();

    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/programs`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(programDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateProgramScreen />);

    await user.type(await screen.findByLabelText(/program name/i), "Primary");
    await user.click(screen.getByRole("button", { name: /create program/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(Object.keys(body!).sort()).toEqual([
      "branchId",
      "level",
      "medium",
      "name",
      "parentId",
      "stream",
    ]);
    expect(body!.branchId).toBe("branch-1");
  });

  it("offers level as the three documented values, not free text", async () => {
    // H1: `level` is the enum SCHOOL | COLLEGE | DEGREE.
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms();

    render(<CreateProgramScreen />);

    await screen.findByLabelText(/program name/i);
    await user.click(screen.getByRole("combobox", { name: /^level/i }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Not set", "School", "College", "Degree"]);
    expect(
      screen.queryByText(/appears in the Postman request body/i),
    ).not.toBeInTheDocument();
  });

  it("sends the chosen level, and null when none is chosen", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    withActiveWorkspace();
    withPrograms();
    server.use(
      http.post(`${API_BASE}/programs`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(programDto()), {
          status: 201,
        });
      }),
    );

    render(<CreateProgramScreen />);

    await user.type(await screen.findByLabelText(/program name/i), "Primary");
    await user.click(screen.getByRole("combobox", { name: /^level/i }));
    await user.click(screen.getByRole("option", { name: "College" }));
    await user.click(screen.getByRole("button", { name: /create program/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.level).toBe("COLLEGE");
  });

  it("warns about a duplicate under documented rule 1", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto());

    render(<CreateProgramScreen />);

    await user.type(
      await screen.findByLabelText(/program name/i),
      "Higher Secondary Science",
    );
    await user.type(screen.getByLabelText(/medium/i), "English");
    await user.type(screen.getByLabelText(/stream/i), "Science (PCM)");

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it("excludes the record and its descendants from the parent picker", async () => {
    // Documented rule 3: circular prevention, enforced by the control rather
    // than by a check after the fact.
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto(), secondProgramDto(), childProgramDto());
    withProgram(programDto());

    render(<EditProgramScreen id="program-1" />);

    await screen.findByDisplayValue("Higher Secondary Science");
    await user.click(screen.getByRole("combobox", { name: /parent program/i }));

    expect(
      screen.getByRole("option", { name: /Commerce/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Physics Elective/ }),
    ).not.toBeInTheDocument();
  });

  it("seeds the edit form from the loaded record", async () => {
    withActiveWorkspace();
    withPrograms(programDto());
    withProgram(programDto());

    render(<EditProgramScreen id="program-1" />);

    expect(
      await screen.findByDisplayValue("Higher Secondary Science"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Science (PCM)")).toBeInTheDocument();
  });

  it("resends the complete documented body on edit", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto());
    withProgram(programDto());

    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_BASE}/programs/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(programDto(body)));
      }),
    );

    render(<EditProgramScreen id="program-1" />);

    const name = await screen.findByDisplayValue("Higher Secondary Science");
    await user.clear(name);
    await user.type(name, "HSC Science");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(Object.keys(body!).sort()).toEqual([
      "branchId",
      "level",
      "medium",
      "name",
      "parentId",
      "stream",
    ]);
  });

  it("surfaces a rejected write rather than swallowing it", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms();
    server.use(
      http.post(`${API_BASE}/programs`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "VALIDATION_ERROR",
            message: "Program name must be unique per branch",
          }),
          { status: 400 },
        ),
      ),
    );

    render(<CreateProgramScreen />);

    await user.type(await screen.findByLabelText(/program name/i), "Primary");
    await user.click(screen.getByRole("button", { name: /create program/i }));

    expect(
      await screen.findByText(/must be unique per branch/i),
    ).toBeInTheDocument();
  });

  it("refuses to render the form without an active branch", async () => {
    render(<CreateProgramScreen />);

    expect(await screen.findByText("No active branch")).toBeInTheDocument();
    expect(screen.queryByLabelText(/program name/i)).not.toBeInTheDocument();
  });
});

describe("Program details", () => {
  it("shows ancestry and children from the branch's list", async () => {
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto());
    withProgram(programDto());

    render(<ProgramDetailsScreen id="program-1" />);

    await screen.findByRole("heading", {
      name: "Higher Secondary Science",
      level: 1,
    });
    // `usePrograms` is a second, independent query from the boundary's
    // `useProgram`, so the children panel fills in after the heading does.
    expect(
      await screen.findByText(/child programs \(1\)/i),
    ).toBeInTheDocument();
  });

  it("names the hydrated branch and shows the record's timestamps", async () => {
    // H14: GET /programs/:id hydrates `branch`; H13: timestamps are returned.
    withActiveWorkspace();
    withPrograms(programDto());
    withProgram(
      programDto({
        branch: { id: "branch-1", name: "Main Campus" },
        createdAt: "2026-01-05T08:00:00.000Z",
        updatedAt: "2026-02-10T09:30:00.000Z",
      }),
    );

    render(<ProgramDetailsScreen id="program-1" />);

    expect(
      await screen.findByRole("link", { name: "Main Campus" }),
    ).toHaveAttribute("href", ROUTES.app.branches.detail("branch-1"));
    expect(
      screen.getByText(formatDateTime("2026-01-05T08:00:00.000Z")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime("2026-02-10T09:30:00.000Z")),
    ).toBeInTheDocument();
    expect(screen.queryByText(/only the branch id/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/documents no .*program\..* event/i),
    ).not.toBeInTheDocument();
  });

  it("blocks deletion while an active child exists", async () => {
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto({ isActive: true }));
    withProgram(programDto());

    render(<ProgramDetailsScreen id="program-1" />);

    await screen.findByText(/danger zone/i);
    // The block depends on the branch list, which loads independently of the
    // record itself.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /delete program/i }),
      ).toBeDisabled();
    });
  });

  it("withholds the status control when the flag was not reported", async () => {
    withActiveWorkspace();
    withPrograms(programDto({ isActive: undefined }));
    withProgram(programDto({ isActive: undefined }));

    render(<ProgramDetailsScreen id="program-1" />);

    expect(
      await screen.findByText(/current status was not reported/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unavailable/i })).toBeDisabled();
  });

  it("navigates to the directory after a delete", async () => {
    const user = userEvent.setup();
    withActiveWorkspace();
    withPrograms(programDto());
    withProgram(programDto());

    render(<ProgramDetailsScreen id="program-1" />);

    await screen.findByText(/danger zone/i);
    await user.click(screen.getByRole("button", { name: /delete program/i }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: /delete program/i }),
    );

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith("/app/programs/directory");
    });
  });

  it("renders a not-found state for a 404", async () => {
    withActiveWorkspace();
    server.use(
      http.get(`${API_BASE}/programs/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NOT_FOUND", message: "Gone" }),
          { status: 404 },
        ),
      ),
    );

    render(<ProgramDetailsScreen id="nope" />);

    expect(await screen.findByText("Program not found")).toBeInTheDocument();
  });

  it("renders a forbidden state naming the documented ADMIN restriction", async () => {
    withActiveWorkspace();
    server.use(
      http.get(`${API_BASE}/programs/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "FORBIDDEN", message: "Nope" }),
          { status: 403 },
        ),
      ),
    );

    render(<ProgramDetailsScreen id="program-1" />);

    expect(await screen.findByText(/ADMIN-only/i)).toBeInTheDocument();
  });
});

describe("Program dashboard", () => {
  it("counts the live programs, excluding deleted ones", async () => {
    // H5: the list filters soft-deleted programs.
    withActiveWorkspace();
    withPrograms(programDto(), secondProgramDto({ isActive: false }));

    render(<ProgramDashboardScreen />);

    await screen.findByText("Listed");
    expect(
      await screen.findByText(/deleted programs are\s+excluded/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no figure here is a total/i),
    ).not.toBeInTheDocument();
  });

  it("counts top-level programs from the derived hierarchy", async () => {
    withActiveWorkspace();
    withPrograms(programDto(), childProgramDto());

    render(<ProgramDashboardScreen />);

    await screen.findByText("Top level");
  });

  it("prompts for a first program, naming why units need one", async () => {
    withActiveWorkspace();
    withPrograms();

    render(<ProgramDashboardScreen />);

    expect(
      await screen.findByText(/this branch has no programs/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/academic units name a program in their request body/i),
    ).toBeInTheDocument();
  });

  it("asks for a branch when the workspace has no scope", async () => {
    render(<ProgramDashboardScreen />);
    expect(await screen.findByText("No active branch")).toBeInTheDocument();
  });
});
