import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { AuditExplorer, AuditScreen } from "@/features/audit";

import { auditLogDto } from "@tests/fixtures/audit";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
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

/** Capture the query the list endpoint is called with. */
function captureListQuery(): { current: URLSearchParams | null } {
  const captured: { current: URLSearchParams | null } = { current: null };

  server.use(
    http.get(`${API_BASE}/audit-logs`, ({ request }) => {
      captured.current = new URL(request.url).searchParams;
      return HttpResponse.json(
        successEnvelope([auditLogDto()], {
          meta: {
            pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
          },
        }),
      );
    }),
  );

  return captured;
}

describe("Audit log list", () => {
  it("renders each record with its action, module and actor", async () => {
    render(<AuditScreen />);

    await screen.findByText("system_settings.updated");
    const [row] = screen.getAllByRole("row").slice(1);

    expect(within(row!).getByText("UPDATE")).toBeInTheDocument();
    expect(within(row!).getByText("SYSTEM")).toBeInTheDocument();
    expect(within(row!).getByText("admin@institution.edu")).toBeInTheDocument();
  });

  it("sends the documented pagination and sort parameters", async () => {
    const captured = captureListQuery();

    render(<AuditScreen />);
    await screen.findByText("system_settings.updated");

    await waitFor(() => expect(captured.current).not.toBeNull());
    expect(captured.current!.get("page")).toBe("1");
    expect(captured.current!.get("limit")).toBe("50");
    expect(captured.current!.get("sortBy")).toBe("timestamp");
    expect(captured.current!.get("sortOrder")).toBe("desc");
  });

  it("does not send filters the user has not set", async () => {
    const captured = captureListQuery();

    render(<AuditScreen />);
    await screen.findByText("system_settings.updated");

    await waitFor(() => expect(captured.current).not.toBeNull());
    expect(captured.current!.has("module")).toBe(false);
    expect(captured.current!.has("action")).toBe(false);
    expect(captured.current!.has("search")).toBe(false);
    expect(captured.current!.has("startDate")).toBe(false);
  });

  it("filters on the server rather than in the browser", async () => {
    const user = userEvent.setup();
    const captured = captureListQuery();

    render(<AuditScreen />);
    await screen.findByText("system_settings.updated");

    await user.click(
      screen.getByRole("combobox", { name: "Filter by module" }),
    );
    await user.click(await screen.findByRole("option", { name: "Auth" }));

    await waitFor(() => expect(captured.current!.get("module")).toBe("AUTH"));
  });

  it("returns to the first page when a filter changes", async () => {
    const user = userEvent.setup();
    const captured = captureListQuery();

    render(<AuditScreen />);
    await screen.findByText("system_settings.updated");

    await user.click(
      screen.getByRole("combobox", { name: "Filter by date range" }),
    );
    await user.click(
      await screen.findByRole("option", { name: "Last 7 days" }),
    );

    await waitFor(() => expect(captured.current!.has("startDate")).toBe(true));
    expect(captured.current!.get("page")).toBe("1");
  });

  it("reports the range and total from the envelope's pagination", async () => {
    server.use(
      http.get(`${API_BASE}/audit-logs`, () =>
        HttpResponse.json(
          successEnvelope([auditLogDto()], {
            meta: {
              pagination: {
                page: 1,
                pageSize: 50,
                total: 2492,
                totalPages: 50,
              },
            },
          }),
        ),
      ),
    );

    render(<AuditScreen />);

    expect(await screen.findByText("1–50 of 2,492")).toBeInTheDocument();
  });

  it("renders a failed list through the shared error state", async () => {
    server.use(
      http.get(`${API_BASE}/audit-logs`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "ForbiddenException",
            message: "Out of scope",
          }),
          { status: 403 },
        ),
      ),
    );

    render(<AuditScreen />);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});

describe("Audit analytics", () => {
  it("shows distributions the summary endpoint actually returned", async () => {
    render(<AuditScreen />);

    // The default handler groups by module and action. The label renders while
    // the tile is still a skeleton, so the assertion waits for the value.
    expect(await screen.findByText("Busiest module")).toBeInTheDocument();
    expect(await screen.findAllByText("SYSTEM")).not.toHaveLength(0);
    // Both the module and the action tile report their leader's count.
    expect(await screen.findAllByText("1 records")).toHaveLength(2);
  });

  it("declares the gap rather than showing zeros when the summary is unreadable", async () => {
    server.use(
      http.get(`${API_BASE}/audit-logs/summary`, () =>
        HttpResponse.json(successEnvelope({ somethingUnexpected: true })),
      ),
    );

    render(<AuditScreen />);

    expect(
      await screen.findByText(/summary endpoint answered with a shape/i),
    ).toBeInTheDocument();
  });

  it("falls back to the list's own total when the summary has none", async () => {
    // `meta.pagination.total` is documented; the summary's shape is not.
    server.use(
      http.get(`${API_BASE}/audit-logs/summary`, () =>
        HttpResponse.json(successEnvelope({})),
      ),
      http.get(`${API_BASE}/audit-logs`, () =>
        HttpResponse.json(
          successEnvelope([auditLogDto()], {
            meta: {
              pagination: { page: 1, pageSize: 50, total: 137, totalPages: 3 },
            },
          }),
        ),
      ),
    );

    render(<AuditScreen />);

    expect(await screen.findByText("137")).toBeInTheDocument();
  });

  it("declares the gap when the timeline shape is unreadable", async () => {
    server.use(
      http.get(`${API_BASE}/audit-logs/timeline`, () =>
        HttpResponse.json(successEnvelope({ daily: [{ nope: 1 }] })),
      ),
    );

    render(<AuditScreen />);

    expect(
      await screen.findByText(/timeline endpoint answered with a shape/i),
    ).toBeInTheDocument();
  });
});

describe("Audit record detail", () => {
  it("opens the full record, including the fields list rows omit", async () => {
    const user = userEvent.setup();
    render(<AuditScreen />);

    await user.click(await screen.findByText("system_settings.updated"));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Field changes")).toBeInTheDocument();
    expect(within(drawer).getByText("maintenanceMode")).toBeInTheDocument();
    expect(within(drawer).getByText("Event payload")).toBeInTheDocument();
  });

  it("omits fields the backend did not report rather than showing empty rows", async () => {
    const user = userEvent.setup();
    render(<AuditScreen />);

    await user.click(await screen.findByText("system_settings.updated"));

    const drawer = await screen.findByRole("dialog");
    // The fixture carries no severity, because the documented AuditLog table
    // has no such column.
    expect(within(drawer).queryByText("Severity")).toBeNull();
  });

  it("shows undocumented-but-filterable fields when the backend does send them", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/audit-logs/:id`, () =>
        HttpResponse.json(
          successEnvelope(auditLogDto({ severity: "INFO", executionTime: 42 })),
        ),
      ),
    );

    render(<AuditScreen />);
    await user.click(await screen.findByText("system_settings.updated"));

    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Severity")).toBeInTheDocument();
    expect(within(drawer).getByText("42 ms")).toBeInTheDocument();
  });
});

describe("Audit export", () => {
  it("declares that no export endpoint is documented, and disables the action", async () => {
    const user = userEvent.setup();
    render(<AuditScreen />);

    await screen.findByText("system_settings.updated");
    await user.click(screen.getByRole("button", { name: "Export" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("No export endpoint is documented"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /^Export$/ }),
    ).toBeDisabled();
  });
});

describe("Settings history embedding", () => {
  it("pins the module filter and hides its control", async () => {
    const captured = captureListQuery();

    render(
      <AuditExplorer
        fixedFilters={{ module: "SYSTEM" }}
        lockedFilters={["module"]}
        showAnalytics={false}
      />,
    );

    await screen.findByText("system_settings.updated");
    await waitFor(() => expect(captured.current!.get("module")).toBe("SYSTEM"));

    expect(
      screen.queryByRole("combobox", { name: "Filter by module" }),
    ).toBeNull();
    expect(screen.queryByText("Busiest module")).toBeNull();
  });
});
