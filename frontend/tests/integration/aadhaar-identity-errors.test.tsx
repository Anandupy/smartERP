import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import {
  applicantFormDefaults,
  applicantFormSchema,
} from "@/features/admissions";
import { EditGuardianDialog, type GuardianDto } from "@/features/guardians";

import { failureEnvelope } from "@tests/fixtures/api";
import { server } from "@tests/mocks/server";
import { render, screen, waitFor, within } from "@tests/setup/render";

/**
 * Aadhaar errors reach the field they are about.
 *
 * The backend is the authority on whether an Aadhaar matches the identity it
 * has on record (`409 GOVERNMENT_ID_MISMATCH`, naming `aadhaarNo`). The form
 * only checks the format, for convenience. Synthetic values throughout:
 * format-valid, never issued.
 */

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");
const RECORDED = "234567890123";
const OTHER = "345678901234";
const MISMATCH =
  "Aadhaar number does not match the existing identity record. Please verify the details.";
const FORMAT = "Aadhaar number must be 12 digits and cannot start with 0 or 1.";

function linkedGuardian(): GuardianDto {
  return {
    id: "guardian-1",
    organizationId: "org-1",
    branchId: "branch-1",
    personId: "person-9",
    dob: null,
    firstName: "Anil",
    middleName: null,
    lastName: "Sharma",
    mobilePrimary: "9876543210",
    mobileSecondary: null,
    email: null,
    occupation: null,
    income: null,
    aadhaarNo: RECORDED,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    country: null,
    pincode: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

describe("Aadhaar on the guardian edit", () => {
  beforeEach(() => {
    vi.spyOn(toast, "success");
    vi.spyOn(toast, "error");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function changeAadhaarTo(value: string) {
    const user = userEvent.setup();
    render(
      <EditGuardianDialog
        guardian={linkedGuardian()}
        onOpenChange={() => {}}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Edit guardian" });
    const field = within(dialog).getByRole("textbox", {
      name: /government id \(aadhaar\)/i,
    });
    await user.clear(field);
    await user.type(field, value);
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    return { dialog, field };
  }

  it("shows the backend's mismatch beside the Aadhaar field, keeps the value, and never a success", async () => {
    const requests: unknown[] = [];
    server.use(
      http.patch(
        `${API_BASE}/admissions/guardians/guardian-1`,
        async ({ request }) => {
          requests.push(await request.json());
          return HttpResponse.json(
            failureEnvelope({
              code: "GOVERNMENT_ID_MISMATCH",
              message: MISMATCH,
              details: { field: "aadhaarNo" },
            }),
            { status: 409 },
          );
        },
      ),
    );

    const { dialog, field } = await changeAadhaarTo(OTHER);

    expect(await within(dialog).findByText(MISMATCH)).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(field).toHaveValue(OTHER);
    expect(requests).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();
    // Bound to the field, so not repeated as a toast.
    expect(toast.error).not.toHaveBeenCalled();
    expect(
      within(dialog).getByRole("button", { name: "Save changes" }),
    ).toBeEnabled();
  });

  it("explains a missing attach permission beside the field", async () => {
    const message =
      "This identity has no Aadhaar on record yet. Recording one needs the permission to attach government identifiers.";
    server.use(
      http.patch(`${API_BASE}/admissions/guardians/guardian-1`, () =>
        HttpResponse.json(
          failureEnvelope({
            code: "GOVERNMENT_ID_ATTACH_FORBIDDEN",
            message,
            details: { field: "aadhaarNo" },
          }),
          { status: 403 },
        ),
      ),
    );

    const { dialog } = await changeAadhaarTo(OTHER);

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("refuses an impossible Aadhaar before sending anything", async () => {
    let requests = 0;
    server.use(
      http.patch(`${API_BASE}/admissions/guardians/guardian-1`, () => {
        requests += 1;
        return HttpResponse.json({}, { status: 500 });
      }),
    );

    const { dialog } = await changeAadhaarTo("012345678901");

    expect(await within(dialog).findByText(FORMAT)).toBeInTheDocument();
    expect(requests).toBe(0);
  });
});

describe("Aadhaar on the applicant form", () => {
  const withAadhaar = (aadhaarNo: string) =>
    applicantFormSchema.safeParse({ ...applicantFormDefaults(), aadhaarNo });

  const aadhaarIssue = (aadhaarNo: string) => {
    const result = withAadhaar(aadhaarNo);
    return result.success
      ? undefined
      : result.error.issues.find((i) => i.path[0] === "aadhaarNo")?.message;
  };

  it("accepts an empty or well-formed Aadhaar", () => {
    expect(aadhaarIssue("")).toBeUndefined();
    expect(aadhaarIssue(RECORDED)).toBeUndefined();
  });

  it("explains a malformed one with the backend's own rule", () => {
    for (const value of [
      "012345678901",
      "123456789012",
      "23456789012",
      "2345678901ab",
    ]) {
      expect(aadhaarIssue(value)).toBe(FORMAT);
    }
  });
});
