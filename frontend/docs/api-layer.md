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

## Configurable headers

`headers.ts` provides a `headerRegistry`. Providers are pure functions evaluated
per request, so headers always reflect current state. Defaults registered as
placeholders (returning `null` until wired):

| Header            | Purpose             | Status             |
| ----------------- | ------------------- | ------------------ |
| `X-Request-Id`    | request tracing     | active (auto UUID) |
| `Authorization`   | access token        | placeholder        |
| `X-Tenant-Id`     | multi-tenancy       | placeholder        |
| `X-Branch-Id`     | branch scope        | placeholder        |
| `X-Academic-Year` | academic-year scope | placeholder        |
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
