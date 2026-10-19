import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { useAuth } from "@/core/auth";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import { AcademicUnitPicker } from "@/features/academic-unit";
import {
  AdmissionWorkflowSettingsScreen,
  ApplicantJourneyHubScreen,
} from "@/features/admissions";
import { toWorkspaceAvailability } from "@/features/workspace";

import {
  childUnitDto,
  secondChildUnitDto,
} from "@tests/fixtures/academic-unit";
import {
  errorEnvelope,
  failureEnvelope,
  successEnvelope,
} from "@tests/fixtures/api";
import {
  admissionPolicyDto,
  applicantDto,
  workflowActionDto,
  workflowActionsDto,
} from "@tests/fixtures/applicant";
import { identityDto } from "@tests/fixtures/workspace";
import { resetRouterMock, routerMock } from "@tests/mocks/next-navigation";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } =
    await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

/**
 * Configurable admission workflows — the frontend renders what the backend
 * says: which actions exist, which are blocked and why, and which journey the
 * branch's profile asks for. Nothing here decides legality itself.
 */

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");
const ACTIONS_URL = (id: string) =>
  `${API_BASE}/admissions/applicants/${id}/workflow/actions`;

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

function withActions(
  id: string,
  actions: ReturnType<typeof workflowActionsDto>,
) {
  server.use(
    http.get(ACTIONS_URL(id), () =>
      HttpResponse.json(successEnvelope(actions)),
    ),
  );
}

function renderHub(
  overrides: Partial<Parameters<typeof applicantDto>[0]> = {},
  props: { autoOpenDirectAdmission?: boolean } = {},
) {
  const applicant = applicantDto(overrides);
  render(
    <ApplicantJourneyHubScreen
      applicant={applicant}
      programName="Std 1"
      academicUnitPicker={
        <AcademicUnitPicker programId={applicant.programId} />
      }
      academicUnitPaths={new Map([[childUnitDto().id, "Std 1 → Div A"]])}
      guardiansPanel={<p>Guardians workspace</p>}
      documentsPanel={<p>Documents workspace</p>}
      guardianSummary={<p>Guardian summary</p>}
      documentsSummary={<p>Documents summary</p>}
      renderPersonPanel={() => null}
      {...props}
    />,
  );
  return applicant;
}

describe("Backend-driven workflow actions", () => {
  it("offers exactly the backend's permitted actions and explains blocked ones", async () => {
    withActions(
      "applicant-1",
      workflowActionsDto({
        status: "UNDER_REVIEW",
        actions: [
          workflowActionDto("approve", { to: "APPROVED" }),
          workflowActionDto("waitlist", {
            to: "WAITLISTED",
            remarks: "REQUIRED",
            available: false,
            blockedBy: [{ code: "POLICY_DISABLED", message: "off" }],
          }),
          workflowActionDto("reject", {
            to: "REJECTED",
            permitted: false,
            available: false,
          }),
        ],
      }),
    );

    renderHub({ admissionStatus: "UNDER_REVIEW" });

    const approve = await screen.findByRole("button", { name: "Approve" });
    expect(approve).toBeEnabled();

    const waitlist = screen.getByRole("button", { name: "Waitlist" });
    expect(waitlist).toBeDisabled();
    expect(
      screen.getByText(/turned off for this branch's admission process/i),
    ).toBeInTheDocument();

    // Not permitted: not offered at all.
    expect(
      screen.queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument();
    // Never offered from a client-side table: request documents is legal from
    // UNDER_REVIEW in the engine, but the backend did not list it here.
    expect(
      screen.queryByRole("button", { name: /request documents/i }),
    ).not.toBeInTheDocument();
  });

  it("names the documents a blocked step is waiting for", async () => {
    withActions(
      "applicant-1",
      workflowActionsDto({
        status: "SUBMITTED",
        profile: "VERIFIED_ADMISSION",
        actions: [
          workflowActionDto("startReview", {
            available: false,
            blockedBy: [
              {
                code: "DOCUMENTS_INCOMPLETE",
                message: "missing",
                missing: [
                  {
                    documentTypeId: "t",
                    code: "BC",
                    name: "Birth certificate",
                  },
                ],
              },
            ],
          }),
        ],
      }),
    );

    renderHub({ admissionStatus: "SUBMITTED" });

    expect(
      await screen.findByRole("button", { name: "Start review" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/waiting for verified documents: birth certificate/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified admission")).toBeInTheDocument();
  });

  it("explains a maker/checker refusal on approval", async () => {
    withActions(
      "applicant-1",
      workflowActionsDto({
        status: "UNDER_REVIEW",
        profile: "VERIFIED_ADMISSION",
        actions: [
          workflowActionDto("approve", {
            available: false,
            blockedBy: [{ code: "MAKER_CHECKER_VIOLATION", message: "x" }],
          }),
        ],
      }),
    );

    renderHub({ admissionStatus: "UNDER_REVIEW" });

    expect(
      await screen.findByRole("button", { name: "Approve" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/a different person must approve it/i),
    ).toBeInTheDocument();
  });

  it("shows a retryable error when the actions cannot be loaded", async () => {
    server.use(
      http.get(ACTIONS_URL("applicant-1"), () =>
        HttpResponse.json(
          errorEnvelope({ code: "INTERNAL", message: "boom" }),
          { status: 500 },
        ),
      ),
    );

    renderHub({ admissionStatus: "UNDER_REVIEW" });

    expect(
      await screen.findByText(/available actions could not be loaded/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("keeps admission disabled, with the reason, when the backend blocks it", async () => {
    withActions(
      "applicant-1",
      workflowActionsDto({
        actions: [
          workflowActionDto("admit", {
            to: "ADMITTED",
            available: false,
            blockedBy: [
              {
                code: "DOCUMENTS_INCOMPLETE",
                message: "missing",
                missing: [
                  {
                    documentTypeId: "t",
                    code: "TC",
                    name: "Transfer certificate",
                  },
                ],
              },
            ],
          }),
        ],
      }),
    );

    renderHub();

    expect(
      await screen.findByRole("button", { name: /complete admission/i }),
    ).toBeDisabled();
    expect(screen.getByText(/transfer certificate/i)).toBeInTheDocument();
  });
});

describe("Closing an application", () => {
  const APPLICANT_URL = `${API_BASE}/admissions/applicants/applicant-1`;
  const TRANSITION_URL = `${APPLICANT_URL}/workflow/transition`;

  beforeEach(() => {
    resetRouterMock();
    vi.spyOn(toast, "success");
    vi.spyOn(toast, "error");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const draftActions = () =>
    workflowActionsDto({
      status: "DRAFT",
      actions: [workflowActionDto("submit", { to: "SUBMITTED" })],
      deleteDraft: { permitted: true, available: true },
    });

  const submittedActions = () =>
    workflowActionsDto({
      status: "SUBMITTED",
      actions: [
        workflowActionDto("startReview", { to: "UNDER_REVIEW" }),
        workflowActionDto("withdraw", { to: "WITHDRAWN", remarks: "REQUIRED" }),
        workflowActionDto("cancel", { to: "CANCELLED", remarks: "REQUIRED" }),
      ],
      deleteDraft: { permitted: true, available: false },
    });

  it("offers Delete draft for a draft, never withdraw or cancel, and deletes after confirmation", async () => {
    const user = userEvent.setup();
    withActions("applicant-1", draftActions());
    let deletes = 0;
    server.use(
      http.delete(APPLICANT_URL, () => {
        deletes += 1;
        return HttpResponse.json(
          successEnvelope(null, { message: "Applicant deleted successfully" }),
        );
      }),
    );

    renderHub({ admissionStatus: "DRAFT", personId: null });

    await user.click(
      await screen.findByRole("button", { name: "Delete draft" }),
    );
    expect(
      screen.queryByRole("button", { name: "Withdraw" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel application" }),
    ).not.toBeInTheDocument();

    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete this draft?",
    });
    // The user can tell which record is affected.
    expect(dialog).toHaveTextContent("APP-2026-0001");
    expect(dialog).toHaveTextContent("Riya Sharma");
    expect(deletes).toBe(0);

    await user.click(
      within(dialog).getByRole("button", { name: "Delete draft" }),
    );

    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(
        "/app/admissions/applicants",
      ),
    );
    expect(deletes).toBe(1);
    expect(toast.success).toHaveBeenCalledWith("Draft deleted");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the backend's refusal of a delete and never a success", async () => {
    const user = userEvent.setup();
    withActions("applicant-1", draftActions());
    const message =
      "Only a draft application can be deleted; this application is SUBMITTED. A submitted application is closed by withdrawing or cancelling it.";
    server.use(
      http.delete(APPLICANT_URL, () =>
        HttpResponse.json(
          failureEnvelope({
            code: "APPLICANT_NOT_DELETABLE",
            message,
            details: { status: "SUBMITTED" },
          }),
          { status: 403 },
        ),
      ),
    );

    renderHub({ admissionStatus: "DRAFT", personId: null });

    await user.click(
      await screen.findByRole("button", { name: "Delete draft" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete draft" }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(toast.success).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
    // The dialog stays, and its controls recover for another attempt.
    expect(
      within(dialog).getByRole("button", { name: "Delete draft" }),
    ).toBeEnabled();
  });

  it("does not offer Delete draft once the application is submitted", async () => {
    withActions("applicant-1", submittedActions());

    renderHub({ admissionStatus: "SUBMITTED" });

    expect(
      await screen.findByRole("button", { name: "Withdraw" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete draft" }),
    ).not.toBeInTheDocument();
  });

  it("withdraws only with a reason, and sends it", async () => {
    const user = userEvent.setup();
    withActions("applicant-1", submittedActions());
    const bodies: unknown[] = [];
    server.use(
      http.post(TRANSITION_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          successEnvelope(applicantDto({ admissionStatus: "WITHDRAWN" })),
        );
      }),
    );

    renderHub({ admissionStatus: "SUBMITTED" });

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Withdraw?",
    });
    expect(dialog).toHaveTextContent(/applicant walked away/i);

    await user.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    expect(
      within(dialog).getByText("A reason is required for this action."),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    await user.type(
      within(dialog).getByRole("textbox", { name: /remarks/i }),
      "  Family relocated  ",
    );
    await user.click(within(dialog).getByRole("button", { name: "Withdraw" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Application moved to WITHDRAWN",
      ),
    );
    expect(bodies).toEqual([
      { action: "withdraw", remarks: "Family relocated" },
    ]);
  });

  it("shows the backend's refusal of a cancellation and never a success", async () => {
    const user = userEvent.setup();
    withActions("applicant-1", submittedActions());
    server.use(
      http.post(TRANSITION_URL, () =>
        HttpResponse.json(
          failureEnvelope({
            code: "INVALID_TRANSITION",
            message: "Cannot cancel an application in state WITHDRAWN.",
            details: { from: "WITHDRAWN", action: "cancel" },
          }),
          { status: 400 },
        ),
      ),
    );

    renderHub({ admissionStatus: "SUBMITTED" });

    await user.click(
      await screen.findByRole("button", { name: "Cancel application" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Cancel application?",
    });
    // Distinct from withdrawal: this is the institution's decision.
    expect(dialog).toHaveTextContent(/institution's decision/i);
    await user.type(
      within(dialog).getByRole("textbox", { name: /remarks/i }),
      "Duplicate form",
    );
    // The dismiss control is never also called "Cancel".
    expect(
      within(dialog).getByRole("button", { name: "Go back" }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Cancel application" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot cancel an application in state WITHDRAWN.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });
});

describe("SIMPLE_ADMISSION — one-step admission", () => {
  const simpleDraft = () =>
    workflowActionsDto({
      status: "DRAFT",
      profile: "SIMPLE_ADMISSION",
      actions: [
        workflowActionDto("submit", { to: "SUBMITTED" }),
        workflowActionDto("withdraw", { to: "WITHDRAWN", remarks: "REQUIRED" }),
      ],
      directAdmission: {
        offered: true,
        fromCurrentState: true,
        permitted: true,
        available: true,
      },
    });

  it("replaces the separate workflow steps with one Admit student action", async () => {
    withActions("applicant-1", simpleDraft());
    renderHub({ admissionStatus: "DRAFT", personId: null });

    expect(
      await screen.findByRole("button", { name: /admit student/i }),
    ).toBeEnabled();
    expect(screen.getByText("Simple admission")).toBeInTheDocument();
    // Submit runs inside the one-step admission, so it is not offered separately…
    expect(
      screen.queryByRole("button", { name: /submit application/i }),
    ).not.toBeInTheDocument();
    // …but leaving the process still is.
    expect(
      screen.getByRole("button", { name: "Withdraw" }),
    ).toBeInTheDocument();
  });

  it("admits through POST direct-admit and shows the real identifiers returned", async () => {
    const user = userEvent.setup();
    const body = vi.fn();
    withActions("applicant-1", simpleDraft());
    server.use(
      http.post(
        `${API_BASE}/admissions/applicants/applicant-1/direct-admit`,
        async ({ request }) => {
          body(await request.json());
          return HttpResponse.json(
            successEnvelope({
              studentId: "student-9",
              studentCode: "STU0000000777",
              admissionId: "admission-9",
              admissionNo: "AD-2026-0042",
              enrollmentId: "enrollment-9",
              applicantId: "applicant-1",
              walked: ["submit", "startReview", "approve", "confirmSeat"],
            }),
          );
        },
      ),
    );

    renderHub({ admissionStatus: "DRAFT", personId: null });

    await user.click(
      await screen.findByRole("button", { name: /admit student/i }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/recorded automatically/i),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("combobox", { name: /academic placement/i }),
    );
    await user.click(
      await screen.findByRole("option", { name: /Std 1 → Div A/ }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /^admit student$/i }),
    );

    expect(await screen.findByText("Admission completed")).toBeInTheDocument();
    expect(screen.getByText("STU0000000777")).toBeInTheDocument();
    expect(screen.getByText("AD-2026-0042")).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ academicUnitId: childUnitDto().id });
  });

  it("shows the backend's refusal and never a success", async () => {
    const user = userEvent.setup();
    withActions("applicant-1", simpleDraft());
    server.use(
      http.post(
        `${API_BASE}/admissions/applicants/applicant-1/direct-admit`,
        () =>
          HttpResponse.json(
            errorEnvelope({
              code: "DOCUMENTS_INCOMPLETE",
              message:
                "One or more mandatory documents are missing or unverified.",
            }),
            { status: 409 },
          ),
      ),
    );

    renderHub({ admissionStatus: "DRAFT", personId: null });

    await user.click(
      await screen.findByRole("button", { name: /admit student/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("combobox", { name: /academic placement/i }),
    );
    await user.click(
      await screen.findByRole("option", { name: /Std 1 → Div A/ }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /^admit student$/i }),
    );

    expect(
      await within(dialog).findByText(/admission could not be completed/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/missing or unverified/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Admission completed")).not.toBeInTheDocument();
  });

  it("opens the one-step review straight after a SIMPLE registration", async () => {
    withActions("applicant-1", simpleDraft());
    renderHub(
      { admissionStatus: "DRAFT", personId: null },
      { autoOpenDirectAdmission: true },
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: /^admit student$/i }),
    ).toBeInTheDocument();
  });

  it("does not offer one-step admission under the standard profile", async () => {
    withActions(
      "applicant-1",
      workflowActionsDto({
        status: "DRAFT",
        actions: [workflowActionDto("submit", { to: "SUBMITTED" })],
      }),
    );
    renderHub(
      { admissionStatus: "DRAFT", personId: null },
      { autoOpenDirectAdmission: true },
    );

    expect(
      await screen.findByRole("button", { name: /submit application/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /admit student/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Admission workflow settings", () => {
  function SignedIn({
    children,
    roles,
    permissions,
  }: {
    children: React.ReactNode;
    roles: string[];
    permissions: string[];
  }) {
    const { setSession, isAuthenticated } = useAuth();
    useEffect(() => {
      setSession(
        { id: "user-1", name: "Admin", email: "a@b.c", roles, permissions },
        { accessToken: "token" },
      );
    }, [setSession, roles, permissions]);
    return isAuthenticated ? <>{children}</> : null;
  }

  it("shows the effective policy and where each value comes from, read-only without the permission", async () => {
    server.use(
      http.get(`${API_BASE}/admissions/workflow/policy`, () =>
        HttpResponse.json(
          successEnvelope(
            admissionPolicyDto({
              workflowProfile: "SIMPLE_ADMISSION",
              waitlistEnabled: false,
              sources: {
                ...admissionPolicyDto().sources,
                workflowProfile: "ORGANIZATION",
                waitlistEnabled: "BRANCH",
              },
            }),
          ),
        ),
      ),
    );

    render(
      <SignedIn roles={["STAFF"]} permissions={["admissions.view"]}>
        <AdmissionWorkflowSettingsScreen />
      </SignedIn>,
    );

    const simple = await screen.findByRole("radio", {
      name: /simple admission/i,
    });
    expect(simple).toHaveAttribute("aria-checked", "true");
    expect(simple).toBeDisabled();
    expect(screen.getByText("From the organization")).toBeInTheDocument();
    expect(screen.getByText("Set for this branch")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /waitlist/i })).not.toBeChecked();
    expect(screen.getByText(/read only/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save changes/i }),
    ).not.toBeInTheDocument();
  });

  it("saves a change for this branch with a required reason", async () => {
    const user = userEvent.setup();
    const put = vi.fn();
    server.use(
      http.put(
        `${API_BASE}/config/values/:key`,
        async ({ request, params }) => {
          put(String(params.key), await request.json());
          return HttpResponse.json(successEnvelope({}));
        },
      ),
    );

    render(
      <SignedIn
        roles={["BRANCH_ADMIN"]}
        permissions={["config.admissions.write"]}
      >
        <AdmissionWorkflowSettingsScreen />
      </SignedIn>,
    );

    await user.click(
      await screen.findByRole("radio", { name: /simple admission/i }),
    );
    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();

    await user.type(
      screen.getByLabelText(/reason/i),
      "Small branch, walk-in admissions",
    );
    await user.click(save);

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("admissions.workflow_profile", {
        scopeType: "BRANCH",
        value: "SIMPLE_ADMISSION",
        reason: "Small branch, walk-in admissions",
      }),
    );
    // A branch administrator is never offered organization-wide scope.
    expect(
      screen.queryByRole("radio", { name: /every branch of/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the backend's refusal when a save is rejected", async () => {
    const user = userEvent.setup();
    server.use(
      http.put(`${API_BASE}/config/values/:key`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "ForbiddenException",
            message: "You do not have permission to change this configuration.",
          }),
          { status: 403 },
        ),
      ),
    );

    render(
      <SignedIn roles={["ORG_ADMIN"]} permissions={["config.admissions.write"]}>
        <AdmissionWorkflowSettingsScreen />
      </SignedIn>,
    );

    await user.click(await screen.findByRole("switch", { name: /waitlist/i }));
    await user.type(screen.getByLabelText(/reason/i), "No waitlist this year");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
  });
});
