import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { ROUTES } from "@/constants";

import { documentTypeDto, secondDocumentTypeDto } from "@tests/fixtures/document";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

/**
 * Loaded in `beforeAll` via `vi.doMock` + a dynamic import — mirrors
 * `tests/integration/admission-masters.test.tsx`'s own comment on why this
 * sequencing is necessary rather than the usual hoisted `vi.mock`.
 */
let CreateDocumentTypeScreen: (typeof import("@/features/documents"))["CreateDocumentTypeScreen"];
let DocumentTypeDetailScreen: (typeof import("@/features/documents"))["DocumentTypeDetailScreen"];
let DocumentTypeListScreen: (typeof import("@/features/documents"))["DocumentTypeListScreen"];
let EditDocumentTypeScreen: (typeof import("@/features/documents"))["EditDocumentTypeScreen"];
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

  const screens = await import("@/features/documents");
  CreateDocumentTypeScreen = screens.CreateDocumentTypeScreen;
  DocumentTypeDetailScreen = screens.DocumentTypeDetailScreen;
  DocumentTypeListScreen = screens.DocumentTypeListScreen;
  EditDocumentTypeScreen = screens.EditDocumentTypeScreen;
});

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");
const TYPES_PATH = `${API_BASE}/document-types`;

beforeEach(() => {
  resetRouterMock();
});

function withTypes(...types: ReturnType<typeof documentTypeDto>[]) {
  server.use(
    http.get(TYPES_PATH, () => HttpResponse.json(successEnvelope(types))),
  );
}

function withType(type: ReturnType<typeof documentTypeDto>) {
  server.use(
    http.get(`${TYPES_PATH}/:id`, () => HttpResponse.json(successEnvelope(type))),
  );
}

function bodyRows() {
  return screen.getAllByRole("row").slice(1);
}

describe("Document Types directory", () => {
  it("lists types with identity, file rules and status", async () => {
    withTypes(documentTypeDto());

    render(<DocumentTypeListScreen />);

    await screen.findByText("Birth Certificate");
    const [row] = bodyRows();

    expect(within(row!).getByText("BIRTH_CERTIFICATE")).toBeInTheDocument();
    expect(within(row!).getByText("Active")).toBeInTheDocument();
  });

  it("shows a sensitive-document indicator", async () => {
    withTypes(secondDocumentTypeDto());

    render(<DocumentTypeListScreen />);

    expect(await screen.findByLabelText("Sensitive")).toBeInTheDocument();
  });

  it("narrows by search without sending an unsupported query", async () => {
    const user = userEvent.setup();
    const requestUrls: string[] = [];

    server.use(
      http.get(TYPES_PATH, ({ request }) => {
        requestUrls.push(request.url);
        return HttpResponse.json(
          successEnvelope([documentTypeDto(), secondDocumentTypeDto()]),
        );
      }),
    );

    render(<DocumentTypeListScreen />);
    await screen.findByText("Passport");

    await user.type(
      screen.getByRole("searchbox", { name: /Search document types/i }),
      "Birth",
    );

    await waitFor(() => expect(screen.queryByText("Passport")).toBeNull());

    for (const url of requestUrls) {
      expect(new URL(url).search).toBe("?includeInactive=true");
    }
  });

  it("narrows by status", async () => {
    const user = userEvent.setup();
    withTypes(documentTypeDto(), secondDocumentTypeDto());

    render(<DocumentTypeListScreen />);
    await screen.findByText("Passport");

    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Active" }));

    await waitFor(() => expect(screen.queryByText("Passport")).toBeNull());
    expect(screen.getByText("Birth Certificate")).toBeInTheDocument();
  });

  it("offers a way in when the directory is empty", async () => {
    withTypes();

    render(<DocumentTypeListScreen />);

    expect(await screen.findByText("No document types yet")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /Add document type/ }),
    ).not.toHaveLength(0);
  });

  it("renders a failed list through the shared error state", async () => {
    server.use(
      http.get(TYPES_PATH, () =>
        HttpResponse.json(
          errorEnvelope({ code: "ForbiddenException", message: "No access" }),
          { status: 403 },
        ),
      ),
    );

    render(<DocumentTypeListScreen />);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});

describe("Activating and deactivating a document type", () => {
  it("resends the complete record with isActive flipped", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    withTypes(documentTypeDto({ id: "type-9", isActive: true }));
    server.use(
      http.patch(`${TYPES_PATH}/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          successEnvelope(documentTypeDto({ ...body, isActive: false })),
        );
      }),
    );

    render(<DocumentTypeListScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Birth Certificate/ }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Deactivate/ }));
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ code: "BIRTH_CERTIFICATE", isActive: false });
  });
});

describe("Deleting a document type", () => {
  it("calls DELETE only after confirmation", async () => {
    const user = userEvent.setup();
    let deleted: string | null = null;

    withTypes(documentTypeDto({ id: "type-9" }));
    server.use(
      http.delete(`${TYPES_PATH}/:id`, ({ params }) => {
        deleted = String(params.id);
        return HttpResponse.json(successEnvelope(null));
      }),
    );

    render(<DocumentTypeListScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Actions for Birth Certificate/ }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    expect(deleted).toBeNull();

    await user.click(
      await screen.findByRole("button", { name: "Delete document type" }),
    );

    await waitFor(() => expect(deleted).toBe("type-9"));
  });
});

describe("Creating a document type", () => {
  it("sends the documented fields, including selected MIME types", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;

    server.use(
      http.post(TYPES_PATH, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successEnvelope(documentTypeDto(body)), {
          status: 201,
        });
      }),
    );

    render(<CreateDocumentTypeScreen />);

    await user.type(await screen.findByLabelText("Code"), "TRANSFER_CERT");
    await user.type(screen.getByLabelText("Name"), "Transfer Certificate");
    await user.click(screen.getByText("PDF"));
    await user.click(screen.getByRole("button", { name: /Create document type/ }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      code: "TRANSFER_CERT",
      name: "Transfer Certificate",
      allowedMimeTypes: ["application/pdf"],
      isActive: true,
    });
  });

  it("requires code, name and at least one file type", async () => {
    const user = userEvent.setup();

    render(<CreateDocumentTypeScreen />);

    await user.click(
      await screen.findByRole("button", { name: /Create document type/ }),
    );

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
    expect(screen.getByText("Select at least one file type")).toBeInTheDocument();
  });
});

describe("Editing a document type", () => {
  it("seeds the form from the loaded record", async () => {
    withType(documentTypeDto());

    render(<EditDocumentTypeScreen id="type-1" />);

    expect(await screen.findByLabelText("Code")).toHaveValue("BIRTH_CERTIFICATE");
    expect(screen.getByLabelText("Name")).toHaveValue("Birth Certificate");
  });

  it("returns to the detail screen once saved", async () => {
    const user = userEvent.setup();
    withType(documentTypeDto());

    render(<EditDocumentTypeScreen id="type-1" />);

    await user.click(
      await screen.findByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        ROUTES.app.documents.types.detail("type-1"),
      ),
    );
  });
});

describe("Document type details", () => {
  it("shows every documented field", async () => {
    withType(documentTypeDto());

    render(<DocumentTypeDetailScreen id="type-1" />);

    expect(
      await screen.findByRole("heading", { name: "Birth Certificate" }),
    ).toBeVisible();
    expect(screen.getByText("BIRTH_CERTIFICATE")).toBeInTheDocument();
    expect(screen.getByText("application/pdf, image/jpeg")).toBeInTheDocument();
  });

  it("treats a missing record as an empty state, not a failure", async () => {
    server.use(
      http.get(`${TYPES_PATH}/:id`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "NotFoundException", message: "Not found" }),
          { status: 404 },
        ),
      ),
    );

    render(<DocumentTypeDetailScreen id="missing" />);

    expect(await screen.findByText("Document type not found")).toBeVisible();
  });
});
