import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { MaintenanceScreen } from "@/features/maintenance";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { maintenanceRuleDto } from "@tests/fixtures/maintenance";
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

/** Replace the rules list for one test. */
function withRules(...rules: ReturnType<typeof maintenanceRuleDto>[]) {
  server.use(
    http.get(`${API_BASE}/maintenance-rules`, () =>
      HttpResponse.json(successEnvelope(rules)),
    ),
  );
}

/** Body rows in render order. The first `row` is the header. */
function bodyRows() {
  return screen.getAllByRole("row").slice(1);
}

describe("Maintenance rules list", () => {
  it("lists the configured rules with what each still allows", async () => {
    withRules(
      maintenanceRuleDto({
        id: "rule-1",
        title: "Database indexing",
        scopeType: "GLOBAL",
      }),
    );

    render(<MaintenanceScreen />);

    await screen.findByText("Database indexing");
    const [row] = bodyRows();

    expect(within(row!).getByText("Active")).toBeInTheDocument();
    // Reads are allowed by default, writes are not — stated per row.
    expect(within(row!).getByText("Reads")).toBeInTheDocument();
    expect(within(row!).getByText("Writes")).toBeInTheDocument();
  });

  it("keeps rows navigable as table rows for assistive tech", async () => {
    // A clickable row must not trade its `row` role for `button`.
    withRules(maintenanceRuleDto({ id: "rule-1", title: "Database indexing" }));

    render(<MaintenanceScreen />);

    await screen.findByText("Database indexing");
    expect(bodyRows()).toHaveLength(1);
  });

  it("sorts the highest-precedence active rule to the top", async () => {
    // A global rule overrides everything below it, so it is the one an operator
    // needs to see first when several are active.
    withRules(
      maintenanceRuleDto({
        id: "rule-branch",
        title: "Campus window",
        scopeType: "BRANCH",
        scopeId: "branch-1",
      }),
      maintenanceRuleDto({
        id: "rule-global",
        title: "Global freeze",
        scopeType: "GLOBAL",
      }),
    );

    render(<MaintenanceScreen />);

    await screen.findByText("Global freeze");
    expect(bodyRows()[0]).toHaveTextContent("Global freeze");
  });

  it("puts inactive rules below active ones", async () => {
    withRules(
      maintenanceRuleDto({
        id: "off",
        title: "Retired rule",
        isActive: false,
        scopeType: "GLOBAL",
      }),
      maintenanceRuleDto({
        id: "on",
        title: "Live rule",
        isActive: true,
        scopeType: "FEATURE",
        scopeId: "admission_approval",
      }),
    );

    render(<MaintenanceScreen />);

    await screen.findByText("Live rule");
    expect(bodyRows()[0]).toHaveTextContent("Live rule");
  });

  it("narrows the list by status without sending a query the backend has not documented", async () => {
    const user = userEvent.setup();
    const requestUrls: string[] = [];

    server.use(
      http.get(`${API_BASE}/maintenance-rules`, ({ request }) => {
        requestUrls.push(request.url);
        return HttpResponse.json(
          successEnvelope([
            maintenanceRuleDto({
              id: "on",
              title: "Live rule",
              isActive: true,
            }),
            maintenanceRuleDto({
              id: "off",
              title: "Retired rule",
              isActive: false,
            }),
          ]),
        );
      }),
    );

    render(<MaintenanceScreen />);
    await screen.findByText("Live rule");

    await user.click(
      screen.getByRole("combobox", { name: "Filter by status" }),
    );
    await user.click(await screen.findByRole("option", { name: "Inactive" }));

    await waitFor(() => expect(screen.queryByText("Live rule")).toBeNull());
    expect(screen.getByText("Retired rule")).toBeInTheDocument();

    // The endpoint documents no query parameters, so none are sent.
    for (const url of requestUrls) {
      expect(new URL(url).search).toBe("");
    }
  });

  it("says plainly that filtering happens in the browser", async () => {
    render(<MaintenanceScreen />);

    expect(
      await screen.findByText(
        /searching, filtering and paging run in this browser/i,
      ),
    ).toBeInTheDocument();
  });

  it("offers a way in when there are no rules at all", async () => {
    withRules();

    render(<MaintenanceScreen />);

    expect(
      await screen.findByText("No maintenance rules yet"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /New rule/ })).not.toHaveLength(
      0,
    );
  });

  it("renders a failed list through the shared error state", async () => {
    server.use(
      http.get(`${API_BASE}/maintenance-rules`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ForbiddenException", message: "Nope" }),
          { status: 403 },
        ),
      ),
    );

    render(<MaintenanceScreen />);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});

describe("Deleting a rule", () => {
  it("names the consequence before removing an active rule", async () => {
    const user = userEvent.setup();
    withRules(
      maintenanceRuleDto({ id: "rule-1", title: "Live rule", isActive: true }),
    );

    render(<MaintenanceScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Live rule/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Delete rule/ }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/lifts the restriction immediately/);
  });

  it("deletes only after confirmation", async () => {
    const user = userEvent.setup();
    let deleted: string | null = null;

    withRules(maintenanceRuleDto({ id: "rule-9", title: "Live rule" }));
    server.use(
      http.delete(`${API_BASE}/maintenance-rules/:id`, ({ params }) => {
        deleted = String(params.id);
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<MaintenanceScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Live rule/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Delete rule/ }),
    );
    expect(deleted).toBeNull();

    await user.click(
      await screen.findByRole("button", { name: "Delete rule" }),
    );

    await waitFor(() => expect(deleted).toBe("rule-9"));
  });

  it("abandons the deletion on cancel", async () => {
    const user = userEvent.setup();
    let deleted = false;

    withRules(maintenanceRuleDto({ id: "rule-9", title: "Live rule" }));
    server.use(
      http.delete(`${API_BASE}/maintenance-rules/:id`, () => {
        deleted = true;
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<MaintenanceScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Live rule/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /Delete rule/ }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleted).toBe(false);
  });
});

describe("Active maintenance status", () => {
  it("reports normal operation when nothing applies", async () => {
    render(<MaintenanceScreen />);

    expect(await screen.findByText("Operating normally")).toBeInTheDocument();
  });

  it("announces the rule that is currently applying", async () => {
    server.use(
      http.get(`${API_BASE}/maintenance-rules/active/status`, () =>
        HttpResponse.json(
          successEnvelope({
            isActive: true,
            scopeType: "GLOBAL",
            title: "Planned upgrade",
            shortMessage: "Back at 04:00",
          }),
        ),
      ),
    );

    render(<MaintenanceScreen />);

    expect(await screen.findByText("Planned upgrade")).toBeInTheDocument();
    expect(screen.getByText(/Back at 04:00/)).toBeInTheDocument();
  });

  it("declares the gap rather than claiming all is well when the payload is unreadable", async () => {
    server.use(
      http.get(`${API_BASE}/maintenance-rules/active/status`, () =>
        HttpResponse.json(successEnvelope({ somethingUnexpected: 1 })),
      ),
    );

    render(<MaintenanceScreen />);

    expect(await screen.findByText(/does not recognize/i)).toBeInTheDocument();
    expect(screen.queryByText("Operating normally")).toBeNull();
  });
});
