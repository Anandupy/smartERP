import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useFormContext } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import {
  createMemoryWorkspaceStorage,
  setWorkspaceStorage,
  useWorkspaceStore,
} from "@/core/workspace";
import {
  CreateDocumentRequirementScreen,
  DocumentRequirementListScreen,
  EditDocumentRequirementScreen,
  OptionalSelectField,
} from "@/features/documents";
import { toWorkspaceAvailability } from "@/features/workspace";

import {
  documentRequirementDto,
  documentTypeDto,
  secondDocumentTypeDto,
} from "@tests/fixtures/document";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { identityDto } from "@tests/fixtures/workspace";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor } from "@tests/setup/render";

vi.mock("next/navigation", async () => {
  const { createNextNavigationMock } = await import("@tests/mocks/next-navigation");
  return createNextNavigationMock();
});

const { resetRouterMock } = await import("@tests/mocks/next-navigation");

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");
const REQUIREMENTS_PATH = `${API_BASE}/document-requirements`;
const TYPES_PATH = `${API_BASE}/document-types`;

const STAGE_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
];

/** A minimal stand-in for the composition route's picker slots. */
function StubPicker({ name, label }: { name: string; label: string }) {
  const form = useFormContext();
  if (!form) return null;
  return (
    <OptionalSelectField
      control={form.control}
      name={name}
      label={label}
      allLabel={`All ${label.toLowerCase()}s`}
      options={[{ value: "program-1", label: "B.Sc IT" }]}
    />
  );
}

function pickers() {
  return {
    programPicker: <StubPicker name="appliesToProgramId" label="Program" />,
    quotaPicker: <StubPicker name="appliesToQuotaId" label="Quota" />,
    categoryPicker: <StubPicker name="appliesToCategoryId" label="Category" />,
  };
}

beforeEach(() => {
  resetRouterMock();
  setWorkspaceStorage(createMemoryWorkspaceStorage());
  useWorkspaceStore.setState({
    availability: null,
    selection: { organizationId: null, branchId: null, academicYearId: null },
    status: "idle",
    reason: null,
  });
  server.use(
    http.get(TYPES_PATH, () =>
      HttpResponse.json(successEnvelope([documentTypeDto(), secondDocumentTypeDto()])),
    ),
  );
});

function withActiveWorkspace(branchId = "branch-1") {
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: { organizationId: "org-1", branchId, academicYearId: "ay-2026" },
    status: "ready",
    reason: null,
  });
}

/** A resolved workspace where no branch is selected — e.g. a role that must choose one. */
function withReadyNoBranch() {
  useWorkspaceStore.setState({
    availability: toWorkspaceAvailability(identityDto()),
    selection: { organizationId: "org-1", branchId: null, academicYearId: null },
    status: "ready",
    reason: null,
  });
}

function withRequirements(...requirements: ReturnType<typeof documentRequirementDto>[]) {
  server.use(
    http.get(REQUIREMENTS_PATH, () => HttpResponse.json(successEnvelope(requirements))),
  );
}

const emptyMap = new Map<string, string>();

describe("Document Requirements directory", () => {
  it("says an active branch is required before it queries", () => {
    withReadyNoBranch();
    render(
      <DocumentRequirementListScreen
        programNames={emptyMap}
        programOptions={[]}
        quotaNames={emptyMap}
        categoryNames={emptyMap}
        stageOptions={STAGE_OPTIONS}
      />,
    );

    expect(screen.getByText("No active branch")).toBeInTheDocument();
  });

  it("lists requirements resolved against document type and program names", async () => {
    withActiveWorkspace();
    withRequirements(documentRequirementDto({ appliesToProgramId: "program-1" }));

    render(
      <DocumentRequirementListScreen
        programNames={new Map([["program-1", "B.Sc IT"]])}
        programOptions={[{ value: "program-1", label: "B.Sc IT" }]}
        quotaNames={emptyMap}
        categoryNames={emptyMap}
        stageOptions={STAGE_OPTIONS}
      />,
    );

    expect(await screen.findByText("Birth Certificate")).toBeInTheDocument();
    expect(screen.getByText("B.Sc IT")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("renders 'All' for a null scope axis", async () => {
    withActiveWorkspace();
    withRequirements(documentRequirementDto({ appliesToQuotaId: null }));

    render(
      <DocumentRequirementListScreen
        programNames={emptyMap}
        programOptions={[]}
        quotaNames={emptyMap}
        categoryNames={emptyMap}
        stageOptions={STAGE_OPTIONS}
      />,
    );

    await screen.findByText("Birth Certificate");
    expect(screen.getAllByText("All").length).toBeGreaterThan(0);
  });

  it("offers a way in when the directory is empty", async () => {
    withActiveWorkspace();
    withRequirements();

    render(
      <DocumentRequirementListScreen
        programNames={emptyMap}
        programOptions={[]}
        quotaNames={emptyMap}
        categoryNames={emptyMap}
        stageOptions={STAGE_OPTIONS}
      />,
    );

    expect(
      await screen.findByText("No document requirements configured"),
    ).toBeVisible();
  });

  it("renders a failed list through the shared error state", async () => {
    withActiveWorkspace();
    server.use(
      http.get(REQUIREMENTS_PATH, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ForbiddenException", message: "No access" }),
          { status: 403 },
        ),
      ),
    );

    render(
      <DocumentRequirementListScreen
        programNames={emptyMap}
        programOptions={[]}
        quotaNames={emptyMap}
        categoryNames={emptyMap}
        stageOptions={STAGE_OPTIONS}
      />,
    );

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});

describe("Creating a document requirement", () => {
  it("says an active branch is required before rendering the form", () => {
    withReadyNoBranch();
    render(
      <CreateDocumentRequirementScreen {...pickers()} stageOptions={STAGE_OPTIONS} />,
    );

    expect(screen.getByText("No active branch")).toBeInTheDocument();
  });

  it("sends the documented Create body, without isActive", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(REQUIREMENTS_PATH, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(documentRequirementDto(body)), {
          status: 201,
        });
      }),
    );

    render(
      <CreateDocumentRequirementScreen {...pickers()} stageOptions={STAGE_OPTIONS} />,
    );

    await user.click(await screen.findByRole("combobox", { name: "Document type" }));
    await user.click(await screen.findByRole("option", { name: /Birth Certificate/ }));
    await user.click(screen.getByRole("combobox", { name: "Required by stage" }));
    await user.click(await screen.findByRole("option", { name: "Draft" }));
    await user.click(screen.getByRole("button", { name: /Add requirement/ }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      branchId: "branch-1",
      documentTypeId: "type-1",
      requiredByStage: "DRAFT",
      isMandatory: true,
      appliesToProgramId: null,
      appliesToQuotaId: null,
      appliesToCategoryId: null,
    });
    expect(body).not.toHaveProperty("isActive");
  });
});

describe("Editing a document requirement", () => {
  it("seeds the form from the loaded record and resends isActive on save", async () => {
    withActiveWorkspace();
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.get(`${REQUIREMENTS_PATH}/:id`, () =>
        HttpResponse.json(successEnvelope(documentRequirementDto())),
      ),
      http.patch(`${REQUIREMENTS_PATH}/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(documentRequirementDto(body)));
      }),
    );

    render(
      <EditDocumentRequirementScreen
        id="requirement-1"
        {...pickers()}
        stageOptions={STAGE_OPTIONS}
      />,
    );

    await screen.findByRole("combobox", { name: "Document type" });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ isActive: true, isMandatory: true });
  });
});
