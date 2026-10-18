# API Layer (`src/core/api`)

For envelope shapes, `ApiError` fields, and `Result` helpers, see
[Response Handling](./response-handling.md). This page covers the client,
headers, interceptors, and retry.

## Client

`client.ts` exposes a configured Axios singleton `apiClient`, a `createApiClient`
factory (for isolated test clients), and a typed `api` helper that unwraps the
backend success envelope:

```ts
import { api } from "@/core/api";

const student = await api.get<Student>(`/students/${id}`); // unwrapped data
const page = await api.getEnvelope<Student[]>("/students", { params });
// page.data → Student[], page.meta?.pagination → { page, total, … }
```

Configuration comes from `config/api.config.ts` (base URL, timeout, retry) which
reads validated env from `config/env.ts`.

## API versioning

The backend versions its surface (`v1` today). The frontend never spells a
version into a request path — `api.config.ts` composes it once:

```ts
apiConfig.root; // "http://localhost:3001"    ← NEXT_PUBLIC_API_URL
apiConfig.version; // "v1"                    ← NEXT_PUBLIC_API_VERSION
apiConfig.baseURL; // "http://localhost:3001/v1" ← what the client uses

api.post("/auth/login", body); // → POST http://localhost:3001/v1/auth/login
```

Rules:

- `NEXT_PUBLIC_API_URL` is the **unversioned** root — never include `/v1` in it.
- `NEXT_PUBLIC_API_VERSION` is validated against `/^v\d+$/`, so a typo fails at
  boot instead of producing 404s at runtime.
- Services call version-agnostic paths (`api.get("/students")`); the client
  resolves them against `baseURL`. Moving to `v2` is a deployment change.
- Need a version-agnostic URL (health probe, docs link)? Build it from
  `apiConfig.root`, and only then.

Both variables are documented in `.env.example`.

## Configurable headers

`headers.ts` provides a `headerRegistry`. Providers are pure functions evaluated
per request, so headers always reflect current state. Defaults registered as
placeholders (returning `null` until wired):

| Header            | Purpose             | Status             |
| ----------------- | ------------------- | ------------------ |
| `X-Request-Id`    | request tracing     | active (auto UUID) |
| `Authorization`   | access token        | placeholder        |
| `X-Organization-Id` | organization scope | from `core/workspace` when `ready` |
| `X-Branch-Id`     | branch scope        | placeholder        |
| `X-Academic-Year-Id` | academic-year scope | from `core/workspace` when `ready` |
| `X-Workspace-Id`  | workspace scope     | placeholder        |

Wire one later:

```ts
headerRegistry.register(REQUEST_HEADERS.authorization, () =>
  getTokenStorage().getAccessToken()
    ? `Bearer ${getTokenStorage().getAccessToken()}`
    : null,
);
```

## Interceptors

- **Request**: attaches resolved dynamic headers.
- **Response**: normalizes every failure into a typed `ApiError` and invokes the
  optional `unauthorizedHandler` on 401 (the refresh-token seam).

### The 401 recovery seam

`setUnauthorizedHandler(handler)` registers the recovery path. Resolving `true`
means "recovered — replay the original request once"; anything else lets the
`ApiError` propagate.

Each request may be replayed **at most once**: the config is marked internally,
so an endpoint that keeps returning 401 cannot loop. The auth feature registers
the handler in `AuthIntegration`, where it performs a single-flight refresh —
see [Authentication](./authentication.md).

The `Authorization` header follows the same pattern: `core/api` registers a
placeholder returning `null`, and the auth feature replaces it with a provider
that reads the current access token. Core never learns what a token is.

## Error normalization

`errors.ts` converts any thrown value into a typed `ApiError`, preferring the
structured backend failure envelope (`code`, `message`, `requestId`,
`timestamp`) and falling back to status-based categorization. Consumers branch on
`error.kind`, never raw status codes. Full detail in
[Response Handling](./response-handling.md).

## Retry strategy

`retry.ts` decides _whether_ a failure is retriable and computes backoff, but the
retry transport is disabled by default (`apiConfig.retry.enabled`) pending
backend idempotency guarantees — a deliberate placeholder.
