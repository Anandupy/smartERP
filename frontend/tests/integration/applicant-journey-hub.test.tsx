import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import { AcademicUnitPicker } from "@/features/academic-unit";
import { ApplicantJourneyHubScreen } from "@/features/admissions";
import { toWorkspaceAvailability } from "@/features/workspace";

import { childUnitDto, secondChildUnitDto } from "@tests/fixtures/academic-unit";
import { successEnvelope } from "@tests/fixtures/api";
import { applicantDto } from "@tests/fixtures/applicant";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } = await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

/**
 * `admit()`'s response carries exactly six identifiers and no placement id
 * (`docs/admission-lifecycle-module.md` §8.6) — so the Journey Hub's
 * post-admit "Academic placement" card has to resolve *where* the student
 * landed from the dialog's own form and the active workspace, not from a
 * second read. This covers that resolution end to end: real
 * `AcademicUnitPicker`, real form submission, mocked `admit()` response.
 */

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

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

  server.use(
    http.get(`${API_BASE}/academic-units`, () =>
      HttpResponse.json(
        successEnvelope([childUnitDto(), secondChildUnitDto()]),
      ),
    ),
  );
});

const noop = () => null;

// The same map `useAcademicUnitDisplayPaths` (the route composition) builds
// from the loaded unit list — reproduced here since this test renders the
// screen directly rather than through the composition.
const ACADEMIC_UNIT_PATHS = new Map([
  [childUnitDto().id, childUnitDto().displayPath ?? childUnitDto().name],
  [secondChildUnitDto().id, secondChildUnitDto().displayPath ?? secondChildUnitDto().name],
]);

function renderHub(overrides: Partial<Parameters<typeof applicantDto>[0]> = {}) {
  const applicant = applicantDto(overrides);

  render(
    <ApplicantJourneyHubScreen
      applicant={applicant}
      programName="Std 1"
      academicUnitPicker={<AcademicUnitPicker programId={applicant.programId} />}
      academicUnitPaths={ACADEMIC_UNIT_PATHS}
      guardiansPanel={<p>Guardians workspace</p>}
      documentsPanel={<p>Documents workspace</p>}
      guardianSummary={<p>Guardian summary</p>}
      documentsSummary={<p>Documents summary</p>}
      renderPersonPanel={noop}
    />,
  );

  return applicant;
}

describe("Applicant Journey Hub — admission result", () => {
  it("shows the placement as a full path, program, academic year and an unassigned roll number", async () => {
    const user = userEvent.setup();
    const applicant = renderHub();

    server.use(
      http.post(
        `${API_BASE}/admissions/applicants/${applicant.id}/admit`,
        () =>
          HttpResponse.json(
            successEnvelope({
              studentId: "student-1",
              studentCode: "STU0000000123",
              admissionId: "admission-1",
              admissionNo: "AD-2026-0001",
              enrollmentId: "enrollment-1",
              applicantId: applicant.id,
            }),
          ),
      ),
    );

    await user.click(screen.getByRole("button", { name: /complete admission/i }));

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("combobox", { name: /academic placement/i }),
    );
    await user.click(await screen.findByRole("option", { name: /Std 1 → Div A/ }));
    await user.click(
      within(dialog).getByRole("button", { name: /^complete admission$/i }),
    );

    // The card the successful admit() renders.
    expect(await screen.findByText("Admission completed")).toBeInTheDocument();
    expect(screen.getByText("STU0000000123")).toBeInTheDocument();
    expect(screen.getByText("AD-2026-0001")).toBeInTheDocument();

    // Never the bare "Div A" — always the full, disambiguated path.
    expect(screen.getByText("Std 1 → Div A")).toBeInTheDocument();
    expect(screen.getByText("AY 2026-2027")).toBeInTheDocument();
    expect(screen.getByText("Not yet assigned")).toBeInTheDocument();
  });

  it("shows nothing about a placement before admission completes", () => {
    renderHub({ admissionStatus: "UNDER_REVIEW" });

    expect(screen.queryByText("Admission completed")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /complete admission/i }),
    ).not.toBeInTheDocument();
  });
});
