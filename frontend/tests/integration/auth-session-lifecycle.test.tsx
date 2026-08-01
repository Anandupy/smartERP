import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiConfig } from "@/config";
import { api, ApiError } from "@/core/api";
import {
  createHybridTokenStorage,
  createMemoryTokenStorage,
  getTokenStorage,
  setTokenStorage,
} from "@/core/auth";
import {
  authService,
  clearTokens,
  persistTokens,
  refreshSession,
  registerAuthIntegration,
} from "@/features/auth";
import { errorEnvelope, successEnvelope } from "@tests/fixtures/api";
import { makeAccessToken } from "@tests/mocks/auth-handlers";
import { server } from "@tests/mocks/server";

const API_BASE = apiConfig.baseURL.replace(/\/$/, "");

const FIRST = { accessToken: makeAccessToken(), refreshToken: "refresh-1" };
const ROTATED = {
  accessToken: makeAccessToken({ sub: "user-1" }),
  refreshToken: "refresh-2",
};

let unregister: (() => void) | null = null;

beforeEach(() => {
  setTokenStorage(createMemoryTokenStorage());
});

afterEach(() => {
  unregister?.();
  unregister = null;
  setTokenStorage(createMemoryTokenStorage());
});

describe("refresh", () => {
  it("sends the refresh token in the body, never a cookie", async () => {
    let submitted: unknown = null;
    let sentCredentials: RequestCredentials | undefined;

    server.use(
      http.post(`${API_BASE}/auth/refresh`, async ({ request }) => {
        submitted = await request.json();
        sentCredentials = request.credentials;
        return HttpResponse.json(successEnvelope(ROTATED), { status: 201 });
      }),
    );

    persistTokens(FIRST);
    await refreshSession();

    expect(submitted).toEqual({ refreshToken: "refresh-1" });
    expect(sentCredentials).not.toBe("include");
  });

  it("stores the rotated pair", async () => {
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json(successEnvelope(ROTATED), { status: 201 }),
      ),
    );

    persistTokens(FIRST);
    await refreshSession();

    expect(getTokenStorage().getAccessToken()).toBe(ROTATED.accessToken);
    expect(getTokenStorage().getRefreshToken()).toBe("refresh-2");
  });

  it("is single-flight: concurrent callers share one request", async () => {
    let calls = 0;
    server.use(
      http.post(`${API_BASE}/auth/refresh`, async () => {
        calls += 1;
        return HttpResponse.json(successEnvelope(ROTATED), { status: 201 });
      }),
    );

    persistTokens(FIRST);

    // The backend revokes the presented token on every rotation, so a second
    // concurrent refresh would race and invalidate the winner's session.
    const results = await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ]);

    expect(calls).toBe(1);
    expect(results.every((tokens) => tokens.refreshToken === "refresh-2")).toBe(
      true,
    );
  });

  it("rejects without attempting a request when no refresh token is stored", async () => {
    let calls = 0;
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () => {
        calls += 1;
        return HttpResponse.json(successEnvelope(ROTATED), { status: 201 });
      }),
    );

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(0);
  });

  it("clears credentials when the refresh token is rejected", async () => {
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "UnauthorizedException",
            message: "Invalid refresh token",
          }),
          { status: 401 },
        ),
      ),
    );

    persistTokens(FIRST);
    await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);

    expect(getTokenStorage().getAccessToken()).toBeNull();
    expect(getTokenStorage().getRefreshToken()).toBeNull();
  });
});

describe("authenticated requests", () => {
  it("attaches the stored access token as a bearer header", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(`${API_BASE}/auth/sessions`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json(successEnvelope([]));
      }),
    );

    unregister = registerAuthIntegration(() => {});
    persistTokens(FIRST);

    await authService.getSessions();
    expect(authorization).toBe(`Bearer ${FIRST.accessToken}`);
  });

  it("recovers from a 401 by refreshing once and replaying the request", async () => {
    let sessionCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.post(`${API_BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(successEnvelope(ROTATED), { status: 201 });
      }),
      http.get(`${API_BASE}/auth/sessions`, () => {
        sessionCalls += 1;
        if (sessionCalls === 1) {
          return HttpResponse.json(
            errorEnvelope({
              code: "UnauthorizedException",
              message: "Unauthorized",
            }),
            { status: 401 },
          );
        }
        return HttpResponse.json(successEnvelope([]));
      }),
    );

    unregister = registerAuthIntegration(() => {});
    persistTokens(FIRST);

    await expect(authService.getSessions()).resolves.toEqual([]);
    expect(refreshCalls).toBe(1);
    expect(sessionCalls).toBe(2);
  });

  it("gives up and reports the session lost when the refresh also fails", async () => {
    const onSessionLost = vi.fn();

    server.use(
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "UnauthorizedException",
            message: "Invalid refresh token",
          }),
          { status: 401 },
        ),
      ),
      http.get(`${API_BASE}/auth/sessions`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "UnauthorizedException",
            message: "Unauthorized",
          }),
          { status: 401 },
        ),
      ),
    );

    unregister = registerAuthIntegration(onSessionLost);
    persistTokens(FIRST);

    await expect(authService.getSessions()).rejects.toBeInstanceOf(ApiError);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });

  it("never tries to refresh a failed login", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(successEnvelope(ROTATED), { status: 201 });
      }),
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          errorEnvelope({
            code: "UnauthorizedException",
            message: "Invalid credentials",
          }),
          { status: 401 },
        ),
      ),
    );

    unregister = registerAuthIntegration(() => {});
    persistTokens(FIRST);

    await expect(
      authService.login({ identifier: "a@b.c", password: "wrong" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalls).toBe(0);
  });

  it("replays a request at most once", async () => {
    let calls = 0;
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json(successEnvelope(ROTATED), { status: 201 }),
      ),
      http.get(`${API_BASE}/health`, () => {
        calls += 1;
        return HttpResponse.json(
          errorEnvelope({
            code: "UnauthorizedException",
            message: "Unauthorized",
          }),
          { status: 401 },
        );
      }),
    );

    unregister = registerAuthIntegration(() => {});
    persistTokens(FIRST);

    // A persistently-401 endpoint must not loop: one original + one replay.
    await expect(api.get("/health")).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(2);
  });
});

describe("logout", () => {
  it("sends the refresh token in the body and omits allDevices by default", async () => {
    let submitted: unknown = null;
    let url = "";

    server.use(
      http.post(`${API_BASE}/auth/logout`, async ({ request }) => {
        url = request.url;
        submitted = await request.json();
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    persistTokens(FIRST);
    await authService.logout({ refreshToken: "refresh-1" });

    expect(submitted).toEqual({ refreshToken: "refresh-1" });
    expect(url).not.toContain("allDevices");
  });

  it("sends the literal string the backend compares against", async () => {
    let url = "";
    server.use(
      http.post(`${API_BASE}/auth/logout`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(successEnvelope(null), { status: 201 });
      }),
    );

    await authService.logout({ refreshToken: "refresh-1" }, true);
    expect(url).toContain("allDevices=true");
  });
});

describe("session restoration", () => {
  it("keeps the refresh token, but not the access token, across a reload", () => {
    setTokenStorage(createHybridTokenStorage());
    persistTokens(FIRST);

    // A reload drops in-memory state; storage is all that survives.
    setTokenStorage(createHybridTokenStorage());

    expect(getTokenStorage().getRefreshToken()).toBe("refresh-1");
    expect(getTokenStorage().getAccessToken()).toBeNull();
  });

  it("exchanges the surviving refresh token for a live session", async () => {
    server.use(
      http.post(`${API_BASE}/auth/refresh`, () =>
        HttpResponse.json(successEnvelope(ROTATED), { status: 201 }),
      ),
    );

    setTokenStorage(createHybridTokenStorage());
    persistTokens(FIRST);
    setTokenStorage(createHybridTokenStorage());

    await refreshSession();
    expect(getTokenStorage().getAccessToken()).toBe(ROTATED.accessToken);
  });

  it("leaves nothing behind after clearing", () => {
    setTokenStorage(createHybridTokenStorage());
    persistTokens(FIRST);

    clearTokens();

    expect(getTokenStorage().getAccessToken()).toBeNull();
    expect(getTokenStorage().getRefreshToken()).toBeNull();
    expect(
      window.localStorage.getItem("campusflow:auth.refresh-token"),
    ).toBeNull();
  });
});
