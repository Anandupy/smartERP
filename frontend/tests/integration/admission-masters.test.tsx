import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { ROUTES } from "@/constants";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
// Pure config data — no dependency on "next/navigation" — imported directly
// (not through the feature barrel) so it is available at collection time for
// `it.each` below, ahead of the dynamic import in `beforeAll`.
import { ADMISSION_MASTER_TYPES } from "@/features/admission-masters/config/admission-master-registry";
import { toWorkspaceAvailability } from "@/features/workspace";

import { admissionMasterDto, secondAdmissionMasterDto } from "@tests/fixtures/admission-master";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

/**
 * Loaded in `beforeAll` via `vi.doMock` + a dynamic import, **not** the usual
 * hoisted `vi.mock("next/navigation", …)` + static import pattern every other
 * integration spec uses (see `tests/mocks/next-navigation.ts`).
 *
 * This module's import graph — the feature barrel pulling in all five screens,
 * the registry-driven hooks/service/keys layer, and `@tanstack/react-table` —
 * is large enough that Vitest's static `vi.mock` hoist unreliably wins the
 * race against the real `next/navigation` also being reached through the
 * graph, so `useRouter()` intermittently throws "invariant expected app
 * router to be mounted" even though the mock is declared correctly. Manually
 * sequencing `vi.doMock` before a dynamic `import()` of the screens removes
 * the ambiguity: the mock is guaranteed installed before anything that
 * transitively imports "next/navigation" is evaluated.
 */
let AdmissionMasterDetailScreen: (typeof import("@/features/admission-masters"))["AdmissionMasterDetailScreen"];
let AdmissionMasterListScreen: (typeof import("@/features/admission-masters"))["AdmissionMasterListScreen"];
let AdmissionMastersOverviewScreen: (typeof import("@/features/admission-masters"))["AdmissionMastersOverviewScreen"];
let CreateAdmissionMasterScreen: (typeof import("@/features/admission-masters"))["CreateAdmissionMasterScreen"];
let EditAdmissionMasterScreen: (typeof import("@/features/admission-masters"))["EditAdmissionMasterScreen"];
let resetRouterMock: (typeof import("@tests/mocks/next-navigation"))["resetRouterMock"];
let routerMock: (typeof import("@tests/mocks/next-navigation"))["routerMock"];

beforeAll(async () => {
  vi.resetModules();
  vi.doMock("next/navigation", async () => {
    const { createNextNavigationMock } = await import("@tests/mocks/next-navigation");
    return createNextNavigationMock();
  });

  const navigationMock = await import("@tests/mocks/next-navigation");
  resetRouterMock = navigationMock.resetRouterMock;
  routerMock = navigationMock.routerMock;

  const screens = await import("@/features/admission-masters");
  AdmissionMasterDetailScreen = screens.AdmissionMasterDetailScreen;
  AdmissionMasterListScreen = screens.AdmissionMasterListScreen;
  AdmissionMastersOverviewScreen = screens.AdmissionMastersOverviewScreen;
  CreateAdmissionMasterScreen = screens.CreateAdmissionMasterScreen;
  EditAdmissionMasterScreen = screens.EditAdmissionMasterScreen;
});

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");
const RESOURCE = "blood-groups";
const RESOURCE_PATH = `${API_BASE}/admissions/masters/${RESOURCE}`;

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
 * Every admission master read is scoped to a branch by a required
 * `x-branch-id` header, and the only place the app may learn the active
 * branch is `useWorkspace()`. Without a resolved scope the screens correctly
 * refuse to query, so specs that expect data establish the same starting
 * point the app has after workspace selection.
 */
function withActiveWorkspace(branchId = "branch-1") {
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: { organizationId: "org-1", branchId, academicYearId: "ay-2026" },
    status: "ready",
    reason: null,
  });
}

function withMasters(...masters: ReturnType<typeof admissionMasterDto>[]) {
  server.use(
    http.get(RESOURCE_PATH, () =>
      HttpResponse.json(successEnvelope(masters)),
    ),
  );
}

function withMaster(master: ReturnType<typeof admissionMasterDto>) {
  server.use(
    http.get(`${RESOURCE_PATH}/:id`, () =>
      HttpResponse.json(successEnvelope(master)),
    ),
  );
}

/** Body rows in render order. The first `row` is the header. */
function bodyRows() {
  return screen.getAllByRole("row").slice(1);
}

describe("Admission master directory", () => {
  it("says an active branch is required before it queries", () => {
    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    expect(screen.getByText("No active branch")).toBeInTheDocument();
  });

  it("lists records with identity, description, order and status", async () => {
    withActiveWorkspace();
    withMasters(admissionMasterDto());

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    await screen.findByText("O Positive");
    const [row] = bodyRows();

    expect(within(row!).getByText("O_POS")).toBeInTheDocument();
    expect(
      within(row!).getByText("The most common blood group."),
    ).toBeInTheDocument();
    expect(within(row!).getByText("Active")).toBeInTheDocument();
  });

  it("orders records by display order", async () => {
    withActiveWorkspace();
    withMasters(
      admissionMasterDto({ id: "b", name: "Second", displayOrder: 2 }),
      admissionMasterDto({ id: "a", name: "First", displayOrder: 1 }),
    );

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    await screen.findByText("First");
    expect(bodyRows()[0]).toHaveTextContent("First");
  });

  it("narrows by search without sending a query the backend has not documented", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    const requestUrls: string[] = [];

    server.use(
      http.get(RESOURCE_PATH, ({ request }) => {
        requestUrls.push(request.url);
        return HttpResponse.json(
          successEnvelope([admissionMasterDto(), secondAdmissionMasterDto()]),
        );
      }),
    );

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);
    await screen.findByText("A Positive");

    await user.type(
      screen.getByRole("searchbox", { name: /Search blood groups/i }),
      "O Positive",
    );

    await waitFor(() =>
      expect(screen.queryByText("A Positive")).toBeNull(),
    );

    for (const url of requestUrls) {
      expect(new URL(url).search).toBe("?includeInactive=true");
    }
  });

  it("narrows by status", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    withMasters(admissionMasterDto(), secondAdmissionMasterDto());

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);
    await screen.findByText("A Positive");

    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Active" }));

    await waitFor(() => expect(screen.queryByText("A Positive")).toBeNull());
    expect(screen.getByText("O Positive")).toBeInTheDocument();
  });

  it("says plainly that querying happens in the browser", async () => {
    withActiveWorkspace();

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    expect(
      await screen.findByText(
        /searching, filtering, sorting and paging run in this browser/i,
      ),
    ).toBeInTheDocument();
  });

  it("offers a way in when the directory is empty", async () => {
    withActiveWorkspace();
    withMasters();

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    expect(await screen.findByText("No blood groups yet")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /Add blood group/ }),
    ).not.toHaveLength(0);
  });

  it("renders a failed list through the shared error state", async () => {
    withActiveWorkspace();
    server.use(
      http.get(RESOURCE_PATH, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ForbiddenException", message: "No access" }),
          { status: 403 },
        ),
      ),
    );

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});

describe("Activating and deactivating a record", () => {
  it("names the resulting state, since a mis-click cannot be assumed harmless", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    withMasters(admissionMasterDto({ isActive: true }));

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for O Positive/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Deactivate/ }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Deactivate.*O Positive.*\?/);
  });

  it("resends the complete record with isActive flipped, not a partial body", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    withMasters(admissionMasterDto({ id: "master-9", isActive: true }));
    server.use(
      http.patch(`${RESOURCE_PATH}/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope(admissionMasterDto({ ...body, isActive: false })),
        );
      }),
    );

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for O Positive/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Deactivate/ }),
    );
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      code: "O_POS",
      name: "O Positive",
      isActive: false,
    });
    expect(body).toHaveProperty("metadata");
  });
});

describe("Deleting a record", () => {
  it("describes the soft delete accurately", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    withMasters(admissionMasterDto());

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for O Positive/ }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Delete/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/soft-deleted/i);
    expect(dialog).toHaveTextContent(/no endpoint to restore/i);
  });

  it("calls DELETE only after confirmation", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    let deleted: string | null = null;

    withMasters(admissionMasterDto({ id: "master-9" }));
    server.use(
      http.delete(`${RESOURCE_PATH}/:id`, ({ params }) => {
        deleted = String(params.id);
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for O Positive/ }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    expect(deleted).toBeNull();

    await user.click(
      await screen.findByRole("button", { name: "Delete blood group" }),
    );

    await waitFor(() => expect(deleted).toBe("master-9"));
  });

  it("takes no action when the confirmation is cancelled", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    let deleteCalled = false;

    withMasters(admissionMasterDto());
    server.use(
      http.delete(`${RESOURCE_PATH}/:id`, () => {
        deleteCalled = true;
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<AdmissionMasterListScreen masterType={RESOURCE} />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for O Positive/ }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteCalled).toBe(false);
    expect(screen.getByText("O Positive")).toBeInTheDocument();
  });
});

describe("Creating a record", () => {
  it("sends exactly the documented fields", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(RESOURCE_PATH, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(admissionMasterDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateAdmissionMasterScreen masterType={RESOURCE} />);

    await user.type(await screen.findByLabelText("Code"), "AB_NEG");
    await user.type(screen.getByLabelText("Name"), "AB Negative");
    await user.click(screen.getByRole("button", { name: /Create blood group/ }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      code: "AB_NEG",
      name: "AB Negative",
      displayOrder: 0,
      isActive: true,
      description: null,
    });
    expect(body).toHaveProperty("metadata", {});
  });

  it("requires code and name", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();

    render(<CreateAdmissionMasterScreen masterType={RESOURCE} />);

    await user.click(
      await screen.findByRole("button", { name: /Create blood group/ }),
    );

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
  });

  it("says an active branch is required before rendering the form", () => {
    render(<CreateAdmissionMasterScreen masterType={RESOURCE} />);

    expect(screen.getByText("No active branch")).toBeInTheDocument();
  });
});

describe("Editing a record", () => {
  it("seeds the form from the loaded record", async () => {
    withActiveWorkspace();
    withMaster(admissionMasterDto());

    render(<EditAdmissionMasterScreen masterType={RESOURCE} id="master-1" />);

    expect(await screen.findByLabelText("Code")).toHaveValue("O_POS");
    expect(screen.getByLabelText("Name")).toHaveValue("O Positive");
  });

  it("resends the complete documented body, carrying metadata through unchanged", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    withMaster(admissionMasterDto({ metadata: { rare: true } }));
    server.use(
      http.patch(`${RESOURCE_PATH}/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(admissionMasterDto(body)));
      }),
    );

    render(<EditAdmissionMasterScreen masterType={RESOURCE} id="master-1" />);

    await user.clear(await screen.findByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "O Positive (updated)");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      code: "O_POS",
      name: "O Positive (updated)",
      isActive: true,
    });
    expect(body).toHaveProperty("metadata", { rare: true });
  });

  it("returns to the detail screen once saved", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    withMaster(admissionMasterDto());

    render(<EditAdmissionMasterScreen masterType={RESOURCE} id="master-1" />);

    await user.click(
      await screen.findByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        ROUTES.app.admissionMasters.detail(RESOURCE, "master-1"),
      ),
    );
  });
});

describe("Record details", () => {
  it("shows every documented field", async () => {
    withActiveWorkspace();
    withMaster(admissionMasterDto());

    render(<AdmissionMasterDetailScreen masterType={RESOURCE} id="master-1" />);

    expect(
      await screen.findByRole("heading", { name: "O Positive" }),
    ).toBeVisible();
    expect(screen.getByText("O_POS")).toBeInTheDocument();
    expect(screen.getByText("The most common blood group.")).toBeInTheDocument();
  });

  it("treats a missing record as an empty state, not a failure", async () => {
    withActiveWorkspace();
    server.use(
      http.get(`${RESOURCE_PATH}/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NotFoundException", message: "Not found" }),
          { status: 404 },
        ),
      ),
    );

    render(<AdmissionMasterDetailScreen masterType={RESOURCE} id="missing" />);

    expect(await screen.findByText("Blood Group not found")).toBeVisible();
  });
});

describe("Admission masters overview", () => {
  it("says an active branch is required", () => {
    render(<AdmissionMastersOverviewScreen />);

    expect(screen.getByText("No active branch")).toBeInTheDocument();
  });

  it("links to all 10 masters' directories", async () => {
    withActiveWorkspace();

    render(<AdmissionMastersOverviewScreen />);

    for (const type of ADMISSION_MASTER_TYPES) {
      const link = await screen.findByRole("link", {
        name: new RegExp(type.replace("-", "."), "i"),
      });
      expect(link).toHaveAttribute(
        "href",
        ROUTES.app.admissionMasters.list(type),
      );
    }
  });

  it("shows the fixed catalog size without a network call", async () => {
    withActiveWorkspace();

    render(<AdmissionMastersOverviewScreen />);

    expect(await screen.findByText("Total masters")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });
});

describe("Every admission master resource", () => {
  it.each(ADMISSION_MASTER_TYPES)(
    "%s directory loads its own resource path",
    async (type) => {
      withActiveWorkspace();
      const path = `${API_BASE}/admissions/masters/${type}`;
      let requestedPath = "";

      server.use(
        http.get(path, ({ request }) => {
          requestedPath = new URL(request.url).pathname;
          return HttpResponse.json(successEnvelope([admissionMasterDto()]));
        }),
      );

      render(<AdmissionMasterListScreen masterType={type} />);

      await screen.findByText("O Positive");
      expect(requestedPath).toBe(`/v1/admissions/masters/${type}`);
    },
  );
});
