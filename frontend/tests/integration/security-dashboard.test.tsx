import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiConfig } from "@/config";
import { SecurityDashboardScreen } from "@/features/security";

import { successEnvelope } from "@tests/fixtures/api";
import { server } from "@tests/mocks/server";
import { render, screen } from "@tests/setup/render";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

describe("Account & Security dashboard", () => {
  it("shows the real active-session count and links to every section", async () => {
    server.use(
      http.get(`${API_BASE}/auth/sessions`, () =>
        HttpResponse.json(
          successEnvelope([
            {
              id: "s1",
              device: "Desktop",
              ipAddress: "203.0.113.1",
              userAgent: null,
              createdAt: "2026-08-01T10:00:00.000Z",
            },
            {
              id: "s2",
              device: "Mobile",
              ipAddress: "203.0.113.2",
              userAgent: null,
              createdAt: "2026-08-02T10:00:00.000Z",
            },
          ]),
        ),
      ),
    );

    render(<SecurityDashboardScreen />);

    expect(await screen.findByText("2")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Active Sessions/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Danger Zone/ }),
    ).toBeInTheDocument();

    // Five of the eight sections have no backend behind their writes yet
    // (Change Password was wired to POST /auth/change-password 2026-08-21).
    expect(screen.getAllByText("Backend Pending")).toHaveLength(5);
  });

  it("never shows a fabricated security score", () => {
    render(<SecurityDashboardScreen />);

    expect(screen.queryByText(/\d+%\s*(excellent|good|score)/i)).toBeNull();
    expect(screen.queryByText(/security score/i)).toBeNull();
  });
});
