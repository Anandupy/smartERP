import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { ROUTES } from "@/constants";
import {
  CreateOrganizationScreen,
  EditOrganizationScreen,
  OrganizationDashboardScreen,
  OrganizationDetailsScreen,
  OrganizationDirectoryScreen,
  OrganizationLifecycleScreen,
} from "@/features/organization";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import {
  organizationDto,
  secondOrganizationDto,
} from "@tests/fixtures/organization";
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
});

/** Replace the organizations list for one test. */
function withOrganizations(
  ...organizations: ReturnType<typeof organizationDto>[]
) {
  server.use(
    http.get(`${API_BASE}/organizations`, () =>
      HttpResponse.json(successEnvelope(organizations)),
    ),
  );
}

/** Body rows in render order. The first `row` is the header. */
function bodyRows() {
  return screen.getAllByRole("row").slice(1);
}

describe("Organization directory", () => {
  it("lists organizations with their identity, contact and status", async () => {
    withOrganizations(organizationDto());

    render(<OrganizationDirectoryScreen />);

    await screen.findByText("Horizon Education Trust");
    const [row] = bodyRows();

    expect(within(row!).getByText("horizon-trust")).toBeInTheDocument();
    expect(within(row!).getByText("admin@horizon.edu")).toBeInTheDocument();
    expect(within(row!).getByText("Active")).toBeInTheDocument();
  });

  it("orders organizations by name so the list is stable", async () => {
    // The endpoint documents no sortBy, so ordering is the client's to choose
    // and must at least be deterministic.
    withOrganizations(organizationDto(), secondOrganizationDto());

    render(<OrganizationDirectoryScreen />);

    await screen.findByText("Avalon University Group");
    expect(bodyRows()[0]).toHaveTextContent("Avalon University Group");
  });

  it("narrows by search without sending a query the backend has not documented", async () => {
    const user = userEvent.setup();
    const requestUrls: string[] = [];

    server.use(
      http.get(`${API_BASE}/organizations`, ({ request }) => {
        requestUrls.push(request.url);
        return HttpResponse.json(
          successEnvelope([organizationDto(), secondOrganizationDto()]),
        );
      }),
    );

    render(<OrganizationDirectoryScreen />);
    await screen.findByText("Avalon University Group");

    await user.type(
      screen.getByRole("searchbox", { name: "Search organizations" }),
      "horizon",
    );

    await waitFor(() =>
      expect(screen.queryByText("Avalon University Group")).toBeNull(),
    );
    expect(screen.getByText("Horizon Education Trust")).toBeInTheDocument();

    for (const url of requestUrls) {
      expect(new URL(url).search).toBe("");
    }
  });

  it("says plainly that querying happens in the browser", async () => {
    render(<OrganizationDirectoryScreen />);

    expect(
      await screen.findByText(
        /searching, filtering, sorting and paging run in this browser/i,
      ),
    ).toBeInTheDocument();
  });

  it("explains why filtering to inactive returns nothing", async () => {
    // E2: the list excludes INACTIVE organizations, so this empty result
    // needs an explanation rather than a bare empty table.
    const user = userEvent.setup();
    withOrganizations(organizationDto());

    render(<OrganizationDirectoryScreen />);
    await screen.findByText("Horizon Education Trust");

    await user.click(
      screen.getByRole("combobox", { name: "Filter by status" }),
    );
    await user.click(await screen.findByRole("option", { name: "Inactive" }));

    expect(await screen.findByText("None of these are listed")).toBeVisible();
    expect(
      screen.getByText(/returns active and suspended organizations only/i),
    ).toBeVisible();
  });

  it("lists a suspended organization instead of calling it unlisted", async () => {
    // E2: SUSPENDED organizations are returned by the list.
    const user = userEvent.setup();
    withOrganizations(
      organizationDto(),
      organizationDto({
        id: "org-suspended",
        name: "Dormant Trust",
        code: "DORM",
        status: "SUSPENDED",
      }),
    );

    render(<OrganizationDirectoryScreen />);
    await screen.findByText("Horizon Education Trust");

    await user.click(
      screen.getByRole("combobox", { name: "Filter by status" }),
    );
    await user.click(await screen.findByRole("option", { name: "Suspended" }));

    expect(await screen.findByText("Dormant Trust")).toBeVisible();
    expect(
      screen.queryByText("None of these are listed"),
    ).not.toBeInTheDocument();
  });

  it("offers a way in when the directory is empty", async () => {
    withOrganizations();

    render(<OrganizationDirectoryScreen />);

    expect(await screen.findByText("No organizations found")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /Create organization/ }),
    ).not.toHaveLength(0);
  });

  it("renders a failed list through the shared error state", async () => {
    server.use(
      http.get(`${API_BASE}/organizations`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ForbiddenException", message: "No access" }),
          { status: 403 },
        ),
      ),
    );

    render(<OrganizationDirectoryScreen />);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("keeps rows navigable as table rows for assistive tech", async () => {
    withOrganizations(organizationDto());

    render(<OrganizationDirectoryScreen />);
    await screen.findByText("Horizon Education Trust");

    expect(bodyRows()).toHaveLength(1);
  });
});

describe("Deactivating an organization", () => {
  it("describes the soft delete accurately before confirming", async () => {
    const user = userEvent.setup();
    withOrganizations(organizationDto());

    render(<OrganizationDirectoryScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: /Actions for Horizon Education Trust/,
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Deactivate/ }),
    );

    const dialog = await screen.findByRole("alertdialog");
    // The record survives — the copy must not claim otherwise.
    expect(dialog).toHaveTextContent(/record and its data are preserved/i);
    expect(dialog).toHaveTextContent(/no endpoint to reactivate/i);
  });

  it("calls DELETE only after confirmation", async () => {
    const user = userEvent.setup();
    let deleted: string | null = null;

    withOrganizations(organizationDto({ id: "org-9" }));
    server.use(
      http.delete(`${API_BASE}/organizations/:id`, ({ params }) => {
        deleted = String(params.id);
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<OrganizationDirectoryScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: /Actions for Horizon Education Trust/,
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Deactivate/ }),
    );
    expect(deleted).toBeNull();

    await user.click(await screen.findByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(deleted).toBe("org-9"));
  });

  it("abandons the deactivation on cancel", async () => {
    const user = userEvent.setup();
    let called = false;

    withOrganizations(organizationDto());
    server.use(
      http.delete(`${API_BASE}/organizations/:id`, () => {
        called = true;
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<OrganizationDirectoryScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: /Actions for Horizon Education Trust/,
      }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Deactivate/ }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(called).toBe(false);
  });
});

describe("Organization dashboard", () => {
  it("counts what the endpoint returned, not a platform total", async () => {
    withOrganizations(organizationDto(), secondOrganizationDto());

    render(<OrganizationDashboardScreen />);

    expect(await screen.findByText("Listed")).toBeInTheDocument();
    expect(
      screen.getByText("Returned by the organizations endpoint"),
    ).toBeInTheDocument();
  });

  it("declares that inactive counts cannot be derived", async () => {
    render(<OrganizationDashboardScreen />);

    expect(
      await screen.findByText(/an inactive count\s+cannot be derived/i),
    ).toBeInTheDocument();
    // E2: suspended organizations are listed, so they are not unknowable.
    expect(
      screen.queryByText(/suspended count cannot be derived/i),
    ).not.toBeInTheDocument();
  });

  it("surfaces subscriptions that have lapsed or are about to", async () => {
    withOrganizations(
      organizationDto({ name: "Lapsed Trust", masterExpiryDate: "2020-01-01" }),
    );

    render(<OrganizationDashboardScreen />);

    expect(
      await screen.findByText("Subscriptions needing attention"),
    ).toBeVisible();
  });

  it("renders a failed load through the shared error state", async () => {
    server.use(
      http.get(`${API_BASE}/organizations`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "InternalServerError", message: "Boom" }),
          { status: 500 },
        ),
      ),
    );

    render(<OrganizationDashboardScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Something went wrong/,
    );
  });
});

describe("Organization details", () => {
  it("shows every documented field and nothing else", async () => {
    render(<OrganizationDetailsScreen id="org-1" />);

    expect(
      await screen.findByRole("heading", { name: /Horizon Education Trust/ }),
    ).toBeVisible();
    expect(screen.getByText("horizon-trust")).toBeInTheDocument();
    expect(screen.getByText("admin@horizon.edu")).toBeInTheDocument();
    expect(screen.getByText("Asia/Kolkata")).toBeInTheDocument();

    // Fields the design shows but the contract has no room for.
    expect(screen.queryByText(/Total Branches/i)).toBeNull();
    expect(screen.queryByText(/Tax ID/i)).toBeNull();
  });

  it("reports an expired subscription as a date, not as a status", async () => {
    server.use(
      http.get(`${API_BASE}/organizations/:id`, () =>
        HttpResponse.json(
          successEnvelope(
            organizationDto({
              masterExpiryDate: "2020-01-01",
              status: "ACTIVE",
            }),
          ),
        ),
      ),
    );

    render(<OrganizationDetailsScreen id="org-1" />);

    expect(
      await screen.findByText("Master subscription has expired"),
    ).toBeVisible();
    // The status is still whatever the backend said it was.
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("treats a missing organization as an empty state, not a failure", async () => {
    server.use(
      http.get(`${API_BASE}/organizations/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NotFoundException", message: "Not found" }),
          { status: 404 },
        ),
      ),
    );

    render(<OrganizationDetailsScreen id="missing" />);

    expect(await screen.findByText("Organization not found")).toBeVisible();
    expect(
      screen.getByText(/directory lists active and suspended organizations/i),
    ).toBeVisible();
  });
});

describe("Creating an organization", () => {
  it("sends exactly the documented fields", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(`${API_BASE}/organizations`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(organizationDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateOrganizationScreen />);

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

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      name: "Horizon Education Trust",
      code: "horizon-trust",
      contactEmail: "admin@horizon.edu",
      masterExpiryDate: "2030-12-31",
    });
    // Never sent — status is server-managed and absent from the request body.
    expect(body).not.toHaveProperty("status");
    // Blank optionals travel as null, not "".
    expect(body!.logoUrl).toBeNull();
    expect(body!.addressLine2).toBeNull();
  });

  it("rejects a code that is not slug-safe, the one documented rule", async () => {
    const user = userEvent.setup();
    render(<CreateOrganizationScreen />);

    await user.type(await screen.findByLabelText("Code"), "Horizon Trust");
    await user.click(
      screen.getByRole("button", { name: "Create organization" }),
    );

    expect(
      await screen.findByText(
        "Lowercase letters, numbers and single hyphens only",
      ),
    ).toBeVisible();
  });

  it("reports a rejected save inline instead of losing the edit", async () => {
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

    render(<CreateOrganizationScreen />);

    await user.type(
      await screen.findByLabelText("Organization name"),
      "Horizon",
    );
    await user.type(screen.getByLabelText("Code"), "taken");
    await user.type(screen.getByLabelText("Contact email"), "a@b.com");
    await user.type(screen.getByLabelText("Contact phone"), "1");
    await user.type(screen.getByLabelText("Address line 1"), "1");
    await user.type(screen.getByLabelText("City"), "1");
    await user.type(screen.getByLabelText("State"), "1");
    await user.type(screen.getByLabelText("Country"), "1");
    await user.type(screen.getByLabelText("Postal code"), "1");
    await user.type(screen.getByLabelText("Currency"), "INR");
    await user.type(screen.getByLabelText("Master expiry date"), "2030-12-31");

    await user.click(
      screen.getByRole("button", { name: "Create organization" }),
    );

    expect(await screen.findByText("Code already in use")).toBeVisible();
    expect(screen.getByLabelText("Code")).toHaveValue("taken");
  });

  it("marks logo upload as pending rather than offering a dead drop-zone", async () => {
    render(<CreateOrganizationScreen />);

    expect(
      await screen.findByText(/uploading a logo needs a file endpoint/i),
    ).toBeVisible();
  });
});

describe("Editing an organization", () => {
  it("seeds the form from the loaded record", async () => {
    render(<EditOrganizationScreen id="org-1" />);

    expect(await screen.findByLabelText("Organization name")).toHaveValue(
      "Horizon Education Trust",
    );
    expect(screen.getByLabelText("Code")).toHaveValue("horizon-trust");
    expect(screen.getByLabelText("Master expiry date")).toHaveValue(
      "2099-12-31",
    );
  });

  it("resends the complete documented body", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.patch(`${API_BASE}/organizations/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(organizationDto(body)));
      }),
    );

    render(<EditOrganizationScreen id="org-1" />);

    await user.clear(await screen.findByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Pune");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      city: "Pune",
      name: "Horizon Education Trust",
      code: "horizon-trust",
      currency: "INR",
    });
    expect(body).not.toHaveProperty("status");
  });

  it("returns to the detail screen once saved", async () => {
    const user = userEvent.setup();
    render(<EditOrganizationScreen id="org-1" />);

    await user.clear(await screen.findByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Pune");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        ROUTES.app.organizations.detail("org-1"),
      ),
    );
  });
});

describe("Organization lifecycle", () => {
  it("renders every stage the design asks for", async () => {
    render(<OrganizationLifecycleScreen id="org-1" />);

    // Each stage is a heading inside the timeline; "Active" also appears as
    // the status badge in the page header, so the query is scoped to headings.
    await screen.findByRole("heading", { level: 3, name: "Draft" });

    for (const stage of [
      "Draft",
      "Active",
      "Suspended",
      "Expired",
      "Deactivated",
    ]) {
      expect(
        screen.getByRole("heading", { level: 3, name: stage }),
      ).toBeVisible();
    }
  });

  it("marks the stages the contract cannot reach", async () => {
    render(<OrganizationLifecycleScreen id="org-1" />);

    await screen.findByText("Draft");
    // Draft, Suspended and Expired, plus reactivate / suspend / permanent
    // deletion in the danger zone.
    expect(
      screen.getAllByText("Backend Pending").length,
    ).toBeGreaterThanOrEqual(6);
  });

  it("says which lifecycle actions have no endpoint", async () => {
    render(<OrganizationLifecycleScreen id="org-1" />);

    expect(
      await screen.findByText(/No endpoint reverses a deactivation/i),
    ).toBeVisible();
    expect(
      screen.getByText(
        /documented status value, but nothing in the contract sets it/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/platform performs soft deletes only/i),
    ).toBeVisible();
  });

  it("disables every lifecycle control except the documented one", async () => {
    render(<OrganizationLifecycleScreen id="org-1" />);

    expect(
      await screen.findByRole("button", { name: /^Deactivate$/ }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Suspend" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeDisabled();
  });

  it("does not offer deactivation for an already inactive organization", async () => {
    server.use(
      http.get(`${API_BASE}/organizations/:id`, () =>
        HttpResponse.json(
          successEnvelope(organizationDto({ status: "INACTIVE" })),
        ),
      ),
    );

    render(<OrganizationLifecycleScreen id="org-1" />);

    expect(
      await screen.findByRole("button", { name: /Already inactive/ }),
    ).toBeDisabled();
  });

  it("marks the current stage from the reported status", async () => {
    render(<OrganizationLifecycleScreen id="org-1" />);

    expect(await screen.findByText("Current")).toBeVisible();
  });
});
