import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { useAuth } from "@/core/auth";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import { ApplicantWorkflowTimeline } from "@/features/admissions";
import { toWorkspaceAvailability } from "@/features/workspace";
import { formatDateTime } from "@/utils";

import { successEnvelope } from "@tests/fixtures/api";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

/**
 * The workflow history renders `WorkflowHistoryDto` as documented in the
 * OpenAPI schema: the event time is `timestamp`. These tests pin that the
 * time is read from it, that a missing or unreadable one is said so rather
 * than invented, and that raw action verbs, status enums and the system
 * actor are shown in the user's terms.
 */

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");
const CURRENT_USER = "user-current";

beforeEach(() => {
  setWorkspaceStorage(createMemoryWorkspaceStorage());
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
});

function SignedIn({ children }: { children: React.ReactNode }) {
  const { setSession, isAuthenticated } = useAuth();
  useEffect(() => {
    setSession(
      {
        id: CURRENT_USER,
        name: "Admin",
        email: "a@b.c",
        roles: ["SUPER_ADMIN"],
        permissions: [],
      },
      { accessToken: "token" },
    );
  }, [setSession]);
  return isAuthenticated ? <>{children}</> : null;
}

function withHistory(rows: Array<Record<string, unknown>>) {
  server.use(
    http.get(
      `${API_BASE}/admissions/applicants/applicant-1/workflow/history`,
      () => HttpResponse.json(successEnvelope(rows)),
    ),
  );
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "h-1",
  entityType: "APPLICANT",
  entityId: "applicant-1",
  organizationId: "org-1",
  branchId: "branch-1",
  oldStatus: "SUBMITTED",
  newStatus: "UNDER_REVIEW",
  actionType: "startReview",
  remarks: null,
  actionBy: CURRENT_USER,
  timestamp: "2026-10-17T09:30:00.000Z",
  ...overrides,
});

function renderTimeline() {
  render(
    <SignedIn>
      <ApplicantWorkflowTimeline applicantId="applicant-1" />
    </SignedIn>,
  );
}

describe("Applicant workflow history", () => {
  it("shows the recorded event time from `timestamp`", async () => {
    withHistory([row()]);
    renderTimeline();

    const expected = formatDateTime("2026-10-17T09:30:00.000Z");
    const time = await screen.findByText(expected);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-10-17T09:30:00.000Z");
    expect(screen.queryByText(/unknown time/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/time not recorded/i)).not.toBeInTheDocument();
  });

  it("says the time was not recorded when the row has none — never invents one", async () => {
    withHistory([row({ timestamp: undefined })]);
    renderTimeline();

    expect(await screen.findByText("Time not recorded")).toBeInTheDocument();
    expect(screen.queryByRole("time")).not.toBeInTheDocument();
  });

  it("treats an unreadable timestamp the same as a missing one", async () => {
    withHistory([row({ timestamp: "not-a-date" })]);
    renderTimeline();

    expect(await screen.findByText("Time not recorded")).toBeInTheDocument();
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
  });

  it("replaces raw action verbs and status enums with readable labels", async () => {
    withHistory([
      row({
        id: "h-3",
        actionType: "admit",
        oldStatus: "SEAT_CONFIRMED",
        newStatus: "ADMITTED",
      }),
      row({
        id: "h-2",
        actionType: "confirmSeat",
        oldStatus: "APPROVED",
        newStatus: "SEAT_CONFIRMED",
      }),
      row({ id: "h-1" }),
    ]);
    renderTimeline();

    expect(await screen.findByText("Admitted")).toBeInTheDocument();
    expect(screen.getByText("Seat confirmed")).toBeInTheDocument();
    expect(screen.getByText("Review started")).toBeInTheDocument();
    expect(
      screen.queryByText(/startReview|confirmSeat|SEAT_CONFIRMED|UNDER_REVIEW/),
    ).not.toBeInTheDocument();
  });

  it("makes an unknown action readable without guessing its meaning", async () => {
    withHistory([row({ actionType: "someNewAction" })]);
    renderTimeline();

    expect(await screen.findByText("Some new action")).toBeInTheDocument();
  });

  it("names the system and the current user, and shows any other user by id only", async () => {
    withHistory([
      row({ id: "h-3", actionBy: "SYSTEM" }),
      row({ id: "h-2", actionBy: CURRENT_USER }),
      row({ id: "h-1", actionBy: "01a12757-64ac-7631-9bc8-b070cfcf8783" }),
    ]);
    renderTimeline();

    expect(await screen.findByText("by System")).toBeInTheDocument();
    expect(screen.getByText("by You")).toBeInTheDocument();
    expect(
      screen.getByText("01a12757-64ac-7631-9bc8-b070cfcf8783"),
    ).toBeInTheDocument();
  });

  it("shows the empty state when nothing has been recorded", async () => {
    withHistory([]);
    renderTimeline();

    expect(await screen.findByText("No history yet")).toBeInTheDocument();
  });
});
