import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiConfig } from "@/config";
import { HealthMonitorScreen } from "@/features/workspace-admin";

import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { healthCheckResultDto, livenessDto } from "@tests/fixtures/workspace-admin";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

const ROOT = apiConfig.root.replace(/\/$/, "");

describe("System Health Monitor", () => {
  it("shows all three probes as their own dimension when everything is healthy", async () => {
    render(<HealthMonitorScreen />);

    const cards = await screen.findAllByRole("heading", {
      name: /Application|Traffic|Dependencies/,
    });
    expect(cards).toHaveLength(3);

    await waitFor(() => {
      expect(screen.getAllByText("Healthy").length).toBeGreaterThan(0);
    });
  });

  it("distinguishes a database outage: live stays up, traffic and dependencies degrade — never 'application down'", async () => {
    server.use(
      http.get(`${ROOT}/ready`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ServiceUnavailableException", message: "DB unreachable" }),
          { status: 503 },
        ),
      ),
      http.get(`${ROOT}/health`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ServiceUnavailableException", message: "DB unreachable" }),
          { status: 503 },
        ),
      ),
    );

    render(<HealthMonitorScreen />);

    await screen.findByRole("heading", { name: "Application" });

    await waitFor(() => {
      expect(screen.getByText("Not Ready")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Degraded").length).toBeGreaterThan(0);
    expect(screen.queryByText("Application process is not responding.")).toBeNull();
    expect(
      screen.getByText("Instance is not ready to serve traffic."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("One or more system dependencies are unavailable."),
    ).toBeInTheDocument();
  });

  it("reports 'unable to reach' rather than guessing a cause on a total network failure", async () => {
    server.use(
      http.get(`${ROOT}/live`, () => HttpResponse.error()),
      http.get(`${ROOT}/ready`, () => HttpResponse.error()),
      http.get(`${ROOT}/health`, () => HttpResponse.error()),
    );

    render(<HealthMonitorScreen />);

    expect(
      await screen.findByText("Unable to reach the health endpoints"),
    ).toBeVisible();
    expect(
      screen.getAllByText("Unable to reach the health endpoint.").length,
    ).toBeGreaterThan(0);
  });

  it("does not warn that the endpoints are unreachable while they are still loading", async () => {
    render(<HealthMonitorScreen />);

    // Before any probe settles, every probe has no data yet.
    expect(
      screen.queryByText("Unable to reach the health endpoints"),
    ).not.toBeInTheDocument();
    await screen.findAllByText("Healthy");
    expect(
      screen.queryByText("Unable to reach the health endpoints"),
    ).not.toBeInTheDocument();
  });

  it("renders the uptime the process reports", async () => {
    server.use(
      http.get(`${ROOT}/live`, () =>
        HttpResponse.json(successEnvelope(livenessDto({ uptimeSeconds: 90 }))),
      ),
    );

    render(<HealthMonitorScreen />);

    expect(await screen.findByText("1m 30s")).toBeInTheDocument();
  });

  it("renders whatever dependencies /health actually reports, not a fixed list", async () => {
    server.use(
      http.get(`${ROOT}/health`, () =>
        HttpResponse.json(
          successEnvelope(
            healthCheckResultDto({
              details: { database: { status: "up" }, memoryHeap: { status: "up" } },
            }),
          ),
        ),
      ),
    );

    render(<HealthMonitorScreen />);

    expect(await screen.findByText("database")).toBeVisible();
    expect(screen.getByText("memoryHeap")).toBeVisible();
  });

  it("supports a manual refresh", async () => {
    const user = userEvent.setup();
    render(<HealthMonitorScreen />);

    await screen.findAllByText("Healthy");
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findAllByText("Healthy")).not.toHaveLength(0);
  });

  it("marks historical monitoring as backend pending rather than inventing a chart", async () => {
    render(<HealthMonitorScreen />);

    expect(
      await screen.findByText(/historical uptime, incident timelines/i),
    ).toBeVisible();
  });
});
