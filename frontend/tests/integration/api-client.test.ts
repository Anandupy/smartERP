import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiConfig } from "@/config";
import { ApiError, api, isErr, toResult } from "@/core/api";
import { getErrorMessage } from "@/lib";

import {
  errorEnvelope,
  exampleEntity,
  failureEnvelope,
  successEnvelope,
} from "@tests/fixtures/api";
import { server } from "@tests/mocks/server";

const base = apiConfig.baseURL.replace(/\/$/, "");

describe("API client envelope handling", () => {
  it("unwraps the success envelope to the data payload", async () => {
    server.use(
      http.get(`${base}/examples/1`, () =>
        HttpResponse.json(successEnvelope(exampleEntity)),
      ),
    );

    const entity = await api.get<typeof exampleEntity>("/examples/1");
    expect(entity).toEqual(exampleEntity);
  });

  it("returns the full envelope (data + meta) via getEnvelope", async () => {
    const envelope = await api.getEnvelope<unknown[]>("/examples");
    expect(envelope.success).toBe(true);
    expect(envelope.data).toEqual([]);
    expect(envelope.meta?.pagination?.pageSize).toBe(20);
  });

  it("normalizes the failure envelope into a typed ApiError", async () => {
    server.use(
      http.get(`${base}/examples/1`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "FORBIDDEN", message: "No access" }),
          { status: 403 },
        ),
      ),
    );

    await expect(api.get("/examples/1")).rejects.toBeInstanceOf(ApiError);

    try {
      await api.get("/examples/1");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.kind).toBe("forbidden");
      expect(apiError.code).toBe("FORBIDDEN");
      expect(apiError.message).toBe("No access");
      expect(apiError.requestId).toBe("req-test-0001");
    }
  });

  it("reads the code from `error.code`, where the backend puts it today", async () => {
    server.use(
      http.post(`${base}/examples/1`, () =>
        HttpResponse.json(
          failureEnvelope({
            code: "APPLICANT_NOT_DELETABLE",
            message: "Only a draft application can be deleted.",
            details: { status: "SUBMITTED" },
          }),
          { status: 403 },
        ),
      ),
    );

    const failure = await api.post("/examples/1").catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ApiError);
    const apiError = failure as ApiError;
    expect(apiError.code).toBe("APPLICANT_NOT_DELETABLE");
    // With the code known, the backend's own reason is shown — not the
    // generic "You don't have permission to do that."
    expect(getErrorMessage(apiError)).toBe(
      "Only a draft application can be deleted.",
    );
    expect(apiError.fieldErrors).toBeUndefined();
  });

  it("binds a failure that names its field to that field", async () => {
    const message =
      "Aadhaar number does not match the existing identity record. Please verify the details.";
    server.use(
      http.patch(`${base}/examples/1`, () =>
        HttpResponse.json(
          failureEnvelope({
            code: "GOVERNMENT_ID_MISMATCH",
            message,
            details: { field: "aadhaarNo" },
          }),
          { status: 409 },
        ),
      ),
    );

    const apiError = (await api
      .patch("/examples/1", {})
      .catch((e: unknown) => e)) as ApiError;

    expect(apiError.kind).toBe("conflict");
    expect(apiError.code).toBe("GOVERNMENT_ID_MISMATCH");
    expect(apiError.fieldErrors).toEqual([{ field: "aadhaarNo", message }]);
    expect(getErrorMessage(apiError)).toBe(message);
  });

  it("captures failures as a Result via toResult", async () => {
    server.use(
      http.get(`${base}/examples/1`, () =>
        HttpResponse.json(
          errorEnvelope({ code: "SERVER_ERROR", message: "boom" }),
          { status: 500 },
        ),
      ),
    );

    const result = await toResult(api.get("/examples/1"));
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.kind).toBe("server");
    }
  });
});
