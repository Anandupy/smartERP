import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { apiConfig } from "@/config";
import { ApiError, api, isErr, toResult } from "@/core/api";

import {
  errorEnvelope,
  exampleEntity,
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
