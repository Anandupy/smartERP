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
  AcademicUnitDashboardScreen,
  AcademicUnitDetailsScreen,
  AcademicUnitDirectoryScreen,
  AcademicUnitTreeScreen,
  CreateAcademicUnitScreen,
  EditAcademicUnitScreen,
} from "@/features/academic-unit";
import { ProgramPicker } from "@/features/program";
import { toWorkspaceAvailability } from "@/features/workspace";

import {
  academicUnitDto,
  childUnitDto,
  secondChildUnitDto,
} from "@tests/fixtures/academic-unit";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { programDto } from "@tests/fixtures/program";
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

/**
 * Put the app in a **fully** resolved workspace.
 *
 * This module is the first that needs two levels of scope: both `branchId` and
 * `academicYearId` are documented required on the list and tree endpoints.
 */
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

/** A branch but no academic year — the half-scope case. */
function withBranchOnly() {
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: {
      organizationId: "org-1",
      branchId: "branch-1",
      academicYearId: null,
    },
    status: "ready",
    reason: null,
  });
}

/** Replace the scope's unit list for one test. */
function withUnits(...units: ReturnType<typeof academicUnitDto>[]) {
  server.use(
    http.get(`${API_BASE}/academic-units`, () =>
      HttpResponse.json(successEnvelope(units)),
    ),
  );
}

/** Replace the single-unit response for one test. */
function withUnit(unit: ReturnType<typeof academicUnitDto>) {
  server.use(
    http.get(`${API_BASE}/academic-units/:id`, () =>
      HttpResponse.json(successEnvelope(unit)),
    ),
  );
}

/** The program picker, as the route composition supplies it. */
function picker() {
  return <ProgramPicker />;
}

describe("Academic unit scope", () => {
  it("asks for a branch when there is none", async () => {
    render(<AcademicUnitDirectoryScreen />);
    expect(await screen.findByText("No active branch")).toBeInTheDocument();
  });

  it("names the academic year as the missing half when a branch is set", async () => {
    // The fix lives in a different module than a missing branch, so the two
    // are not collapsed into one generic message.
    withBranchOnly();

    render(<AcademicUnitDirectoryScreen />);

    expect(
      await screen.findByText("No academic year selected"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage academic years/i }),
    ).toBeInTheDocument();
  });

  it("sends both documented scope parameters", async () => {
    withActiveScope();

    let params: URLSearchParams | null = null;
    server.use(
      http.get(`${API_BASE}/academic-units`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json(successEnvelope([academicUnitDto()]));
      }),
    );

    render(<AcademicUnitDirectoryScreen />);

    await screen.findByText("Std 1");
    expect(params!.get("branchId")).toBe("branch-1");
    expect(params!.get("academicYearId")).toBe("ay-2026");
  });
});

describe("Academic unit hierarchy", () => {
  it("renders a real tree with accessible levels", async () => {
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto(), secondChildUnitDto());

    render(<AcademicUnitTreeScreen />);

    await screen.findByRole("tree", { name: /academic unit hierarchy/i });
    const items = screen.getAllByRole("treeitem");

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("aria-level", "1");
    expect(items[1]).toHaveAttribute("aria-level", "2");
    expect(items[1]).toHaveAttribute("aria-posinset", "1");
    expect(items[1]).toHaveAttribute("aria-setsize", "2");
  });

  it("orders siblings by the documented displayOrder", async () => {
    withActiveScope();
    withUnits(
      academicUnitDto(),
      childUnitDto({ id: "b", name: "Div B", displayOrder: 2 }),
      childUnitDto({ id: "a", name: "Div A", displayOrder: 1 }),
    );

    render(<AcademicUnitTreeScreen />);

    const items = await screen.findAllByRole("treeitem");
    expect(within(items[1]!).getByText("Div A")).toBeInTheDocument();
    expect(within(items[2]!).getByText("Div B")).toBeInTheDocument();
  });

  it("builds the hierarchy from the flat list, not the tree endpoint", async () => {
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto());
    server.use(
      http.get(`${API_BASE}/academic-units/tree`, () =>
        HttpResponse.json(successEnvelope("unexpected")),
      ),
    );

    render(<AcademicUnitTreeScreen />);

    const items = await screen.findAllByRole("treeitem");
    expect(items).toHaveLength(2);
    expect(
      screen.getByText(/returned a shape this app does not recognise/i),
    ).toBeInTheDocument();
  });

  it("lists orphans separately rather than promoting them to roots", async () => {
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto({ parentId: "gone" }));

    render(<AcademicUnitTreeScreen />);

    await screen.findByText(/not placed in the hierarchy/i);
    expect(screen.getAllByRole("treeitem")).toHaveLength(1);
  });

  it("warns when the data contains a circular parent chain", async () => {
    withActiveScope();
    withUnits(
      academicUnitDto({ id: "p", parentId: "q" }),
      childUnitDto({ id: "q", parentId: "p" }),
    );

    render(<AcademicUnitTreeScreen />);

    expect(
      await screen.findByText(/circular parent chain/i),
    ).toBeInTheDocument();
  });

  it("offers a move that names only legal destinations", async () => {
    // Consistency (same program) and tree (no self, no descendant) rules are
    // enforced by the control rather than validated after the fact.
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto(), secondChildUnitDto());

    render(<AcademicUnitTreeScreen />);
    await screen.findAllByRole("treeitem");

    await user.click(screen.getByRole("button", { name: /move div a/i }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("combobox"));

    expect(screen.getByRole("option", { name: /Std 1/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Div B/ })).toBeInTheDocument();
    // Itself is excluded.
    expect(
      screen.queryByRole("option", { name: /^Div A$/ }),
    ).not.toBeInTheDocument();
  });

  it("sends the move to the documented endpoint with a parentId body", async () => {
    // The only lifecycle endpoint across both academic modules that carries a
    // request body, so it names a target rather than flipping a flag.
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto());

    let body: Record<string, unknown> | null = null;
    let movedId: string | null = null;
    server.use(
      http.patch(
        `${API_BASE}/academic-units/:id/move`,
        async ({ request, params }) => {
          movedId = String(params.id);
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(successEnvelope(childUnitDto()));
        },
      ),
    );

    render(<AcademicUnitTreeScreen />);
    await screen.findAllByRole("treeitem");

    await user.click(screen.getByRole("button", { name: /move div a/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /move unit/i }));

    await waitFor(() => expect(movedId).toBe("unit-2"));
    expect(body).toEqual({ parentId: null });
  });

  it("warns that a moved unit takes its children's levels with it", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto());

    render(<AcademicUnitTreeScreen />);
    await screen.findAllByRole("treeitem");

    await user.click(screen.getByRole("button", { name: /move std 1/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/children move with it/i),
    ).toBeInTheDocument();
  });

  it("shows an empty state explaining that a new year starts empty", async () => {
    withActiveScope();
    withUnits();

    render(<AcademicUnitTreeScreen />);

    await screen.findByText("No academic units yet");
    expect(
      screen.getByText(/a new year starts empty by design/i),
    ).toBeInTheDocument();
  });
});

describe("Academic unit directory", () => {
  it("lists units with program, parent, level and order", async () => {
    withActiveScope();
    withUnits(childUnitDto());

    render(
      <AcademicUnitDirectoryScreen
        programNames={new Map([["program-1", "Higher Secondary Science"]])}
      />,
    );

    await screen.findByText("Div A");
    const rows = screen.getAllByRole("row").slice(1);

    expect(
      within(rows[0]!).getByText("Higher Secondary Science"),
    ).toBeInTheDocument();
    expect(within(rows[0]!).getByText("DIVISION · HHS-001-A")).toBeInTheDocument();
  });

  it("falls back to the program id when no names are supplied", async () => {
    withActiveScope();
    withUnits(childUnitDto());

    render(<AcademicUnitDirectoryScreen />);

    await screen.findByText("Div A");
    expect(screen.getByText("program-1")).toBeInTheDocument();
  });

  it("states that there is no documented programId filter", async () => {
    withActiveScope();
    withUnits(academicUnitDto());

    render(<AcademicUnitDirectoryScreen />);

    await screen.findByText("Std 1");
    expect(
      screen.getByText(/notably there is/i).textContent,
    ).toMatch(/no.*programId.*filter/i);
  });

  it("filters by state in the client", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto({ isActive: false }));

    render(<AcademicUnitDirectoryScreen />);
    await screen.findByText("Div A");

    await user.click(screen.getByRole("combobox", { name: /filter by status/i }));
    await user.click(screen.getByRole("option", { name: "Inactive" }));

    // Asserted on rows rather than on the text: "Std 1" survives as the parent
    // column of the row that remains, which is correct and not what is being
    // tested here.
    await waitFor(() => {
      expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
    });
    const [row] = screen.getAllByRole("row").slice(1);
    expect(within(row!).getByText("Div A")).toBeInTheDocument();
  });

  it("builds the type filter from the data, not from a fixed vocabulary", async () => {
    // The documentation calls unitType a UI tag and warns against hardcoding.
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto({ unitType: "HOUSE" }));

    render(<AcademicUnitDirectoryScreen />);
    await screen.findByText("Std 1");

    await user.click(screen.getByRole("combobox", { name: /filter by type/i }));
    expect(screen.getByRole("option", { name: "HOUSE" })).toBeInTheDocument();
  });

  it("refuses a delete the documented engine rule blocks", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto({ isActive: true }));

    render(<AcademicUnitDirectoryScreen />);
    await screen.findByText("Div A");

    await user.click(screen.getByRole("button", { name: /actions for std 1/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete unit/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/cannot be deleted yet/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Div A/)).toBeInTheDocument();
  });

  it("sends the status toggle with no request body", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto());

    let body: string | null = null;
    server.use(
      http.patch(`${API_BASE}/academic-units/:id/status`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(
          successEnvelope(academicUnitDto({ isActive: false })),
        );
      }),
    );

    render(<AcademicUnitDirectoryScreen />);
    await screen.findByText("Std 1");

    await user.click(screen.getByRole("button", { name: /actions for std 1/i }));
    await user.click(screen.getByRole("menuitem", { name: /deactivate unit/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: /deactivate unit/i }),
    );

    await waitFor(() => expect(body).toBe(""));
  });

  it("renders an error state with a retry", async () => {
    withActiveScope();
    server.use(
      http.get(`${API_BASE}/academic-units`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "SERVER_ERROR", message: "Boom" }),
          { status: 500 },
        ),
      ),
    );

    render(<AcademicUnitDirectoryScreen />);

    expect(
      await screen.findByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});

describe("Academic unit create — the Program seam", () => {
  it("fills the slotted program picker from the Program module", async () => {
    // This is the cross-feature composition: the picker comes from Program,
    // binds itself through `useFormContext()`, and neither feature imports the
    // other.
    const user = userEvent.setup();
    withActiveScope();
    withUnits();
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([programDto()])),
      ),
    );

    render(<CreateAcademicUnitScreen programPicker={picker()} />);

    const program = await screen.findByRole("combobox", { name: /program/i });
    await user.click(program);

    expect(
      await screen.findByRole("option", { name: /Higher Secondary Science/ }),
    ).toBeInTheDocument();
  });

  it("sends exactly the ten documented fields", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits();
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([programDto()])),
      ),
    );

    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/academic-units`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(academicUnitDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateAcademicUnitScreen programPicker={picker()} />);

    await user.click(await screen.findByRole("combobox", { name: /program/i }));
    await user.click(
      await screen.findByRole("option", { name: /Higher Secondary Science/ }),
    );
    await user.type(screen.getByLabelText(/^name$/i), "Div C");
    await user.click(screen.getByRole("button", { name: /create unit/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(Object.keys(body!).sort()).toEqual([
      "academicYearId",
      "branchId",
      "code",
      "displayOrder",
      "isActive",
      "metadata",
      "name",
      "parentId",
      "programId",
      "unitType",
    ]);
    expect(body!.branchId).toBe("branch-1");
    expect(body!.academicYearId).toBe("ay-2026");
    expect(body!.programId).toBe("program-1");
  });

  it("never sends level, which the documentation forbids setting", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits();
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([programDto()])),
      ),
    );

    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/academic-units`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(academicUnitDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateAcademicUnitScreen programPicker={picker()} />);

    await user.click(await screen.findByRole("combobox", { name: /program/i }));
    await user.click(
      await screen.findByRole("option", { name: /Higher Secondary Science/ }),
    );
    await user.type(screen.getByLabelText(/^name$/i), "Div C");
    await user.click(screen.getByRole("button", { name: /create unit/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).not.toHaveProperty("level");
  });

  it("falls back to a disabled field and a note without the slot", async () => {
    withActiveScope();
    withUnits();

    render(<CreateAcademicUnitScreen />);

    expect(
      await screen.findByText(/the program selector is supplied by the route/i),
    ).toBeInTheDocument();
  });

  it("warns about a sibling name clash before submitting", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto());
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([programDto()])),
      ),
    );

    render(<CreateAcademicUnitScreen programPicker={picker()} />);

    await user.type(await screen.findByLabelText(/^name$/i), "Std 1");

    expect(
      await screen.findByText(/a sibling already uses this name/i),
    ).toBeInTheDocument();
  });

  it("rejects metadata that is not a JSON object", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits();
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([programDto()])),
      ),
    );

    render(<CreateAcademicUnitScreen programPicker={picker()} />);

    await user.click(await screen.findByRole("combobox", { name: /program/i }));
    await user.click(
      await screen.findByRole("option", { name: /Higher Secondary Science/ }),
    );
    await user.type(screen.getByLabelText(/^name$/i), "Div C");
    await user.type(screen.getByLabelText(/metadata/i), "not json");
    await user.click(screen.getByRole("button", { name: /create unit/i }));

    expect(
      await screen.findByText(/enter a json object/i),
    ).toBeInTheDocument();
  });

  it("says the branch has no programs when the picker is empty", async () => {
    withActiveScope();
    withUnits();
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(successEnvelope([])),
      ),
    );

    render(<CreateAcademicUnitScreen programPicker={picker()} />);

    expect(
      await screen.findByText(/this branch has no programs to choose from/i),
    ).toBeInTheDocument();
  });
});

describe("Academic unit edit", () => {
  it("seeds the form from the loaded record", async () => {
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto());
    withUnit(childUnitDto());

    render(<EditAcademicUnitScreen id="unit-2" programPicker={picker()} />);

    expect(await screen.findByDisplayValue("Div A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("HHS-001-A")).toBeInTheDocument();
  });

  it("explains why re-parenting is done through Move rather than the form", async () => {
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto());
    withUnit(childUnitDto());

    render(<EditAcademicUnitScreen id="unit-2" programPicker={picker()} />);

    await screen.findByDisplayValue("Div A");
    expect(
      await screen.findByText(/which one the backend treats as authoritative/i),
    ).toBeInTheDocument();
  });

  it("resends the complete documented body", async () => {
    const user = userEvent.setup();
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto());
    withUnit(childUnitDto());

    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_BASE}/academic-units/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(academicUnitDto(body)));
      }),
    );

    render(<EditAcademicUnitScreen id="unit-2" programPicker={picker()} />);

    const name = await screen.findByDisplayValue("Div A");
    await user.clear(name);
    await user.type(name, "Division A");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(Object.keys(body!)).toHaveLength(10);
    expect(body).not.toHaveProperty("level");
  });
});

describe("Academic unit details", () => {
  it("shows ancestry, children and the level", async () => {
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto(), secondChildUnitDto());
    withUnit(childUnitDto());

    render(<AcademicUnitDetailsScreen id="unit-2" />);

    await screen.findByRole("heading", { name: "Div A", level: 1 });
    expect(await screen.findByText(/child units \(0\)/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Std 1" })).toBeInTheDocument();
  });

  it("resolves the program name from the map the route supplies", async () => {
    withActiveScope();
    withUnits(academicUnitDto());
    withUnit(academicUnitDto());

    render(
      <AcademicUnitDetailsScreen
        id="unit-1"
        programNames={new Map([["program-1", "Higher Secondary Science"]])}
      />,
    );

    expect(
      await screen.findByRole("link", { name: "Higher Secondary Science" }),
    ).toBeInTheDocument();
  });

  it("renders metadata verbatim without interpreting a key", async () => {
    withActiveScope();
    withUnits(academicUnitDto());
    withUnit(academicUnitDto({ metadata: { roomCapacity: 40 } }));

    render(<AcademicUnitDetailsScreen id="unit-1" />);

    await screen.findByRole("heading", { name: "Std 1", level: 1 });
    expect(screen.getByText("roomCapacity")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
  });

  it("marks a derived level when the response omits one", async () => {
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto({ level: undefined }));
    withUnit(childUnitDto({ level: undefined }));

    render(<AcademicUnitDetailsScreen id="unit-2" />);

    expect(await screen.findByText(/1 \(derived\)/)).toBeInTheDocument();
  });

  it("names the academic year as a reason a unit may not be found", async () => {
    // A unit id is valid in one year's scope and absent from another's, so
    // "deleted" is not the only explanation.
    withActiveScope();
    server.use(
      http.get(`${API_BASE}/academic-units/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NOT_FOUND", message: "Gone" }),
          { status: 404 },
        ),
      ),
    );

    render(<AcademicUnitDetailsScreen id="nope" />);

    await screen.findByText("Academic unit not found");
    expect(
      screen.getByText(/different academic year than the one currently selected/i),
    ).toBeInTheDocument();
  });
});

describe("Academic unit dashboard", () => {
  it("names the academic year the structure belongs to", async () => {
    // Load-bearing: an empty structure in an unnoticed year reads as data loss.
    withActiveScope();
    withUnits(academicUnitDto());

    render(<AcademicUnitDashboardScreen />);

    expect(await screen.findByText(/scoped to/i)).toBeInTheDocument();
  });

  it("reports the depth of the derived hierarchy", async () => {
    withActiveScope();
    withUnits(academicUnitDto(), childUnitDto());

    render(<AcademicUnitDashboardScreen />);

    await screen.findByText("Depth");
    expect(screen.getByText("Programs covered")).toBeInTheDocument();
  });

  it("says the figures are not totals", async () => {
    withActiveScope();
    withUnits(academicUnitDto());

    render(<AcademicUnitDashboardScreen />);

    expect(
      await screen.findByText(/no figure here is a total/i),
    ).toBeInTheDocument();
  });

  it("asks for the missing half of the scope", async () => {
    withBranchOnly();

    render(<AcademicUnitDashboardScreen />);

    expect(
      await screen.findByText("No academic year selected"),
    ).toBeInTheDocument();
  });
});
