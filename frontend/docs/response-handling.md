# Response Handling

The frontend understands the backend's two standard envelopes and never leaks
raw Axios or wire shapes into features.

## Envelopes (`src/types/api.ts`)

**Success**

```ts
interface ApiResponse<TData> {
  success: true;
  message: string | null;
  data: TData;
  meta: ApiMeta | null; // requestId, timestamp, pagination, …
  error: null;
}
```

**Failure**

```ts
interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
  requestId?: string;
  timestamp?: string;
}
```

Runtime guards `isApiResponse` / `isApiErrorResponse` discriminate an unknown
body by its `success` flag.

## Reading responses (`src/core/api/client.ts`)

- `api.get/post/put/patch/delete<T>()` — unwrap the success envelope and return
  the `data` payload (the common case).
- `api.getEnvelope<T>()` — returns the full `ApiResponse<T>` when the caller also
  needs `meta` (e.g. list pagination via `meta.pagination`).

`createResourceService.list` uses `getEnvelope`, so list hooks expose both items
(`data`) and pagination (`meta`).

## Errors (`src/core/api/errors.ts`)

The response interceptor converts every failure into a typed **`ApiError`**:

| Field         | Source                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `kind`        | coarse category derived from HTTP status (`forbidden`, `validation`, `server`, `network`, `timeout`, …) |
| `status`      | HTTP status (or `null` for network/timeout)                                                             |
| `code`        | `code` from the failure envelope                                                                        |
| `message`     | `message` from the failure envelope                                                                     |
| `requestId`   | envelope `requestId`, falling back to the `X-Request-Id` response header                                |
| `timestamp`   | envelope `timestamp`                                                                                    |
| `fieldErrors` | best-effort `errors`/`details` array for form binding                                                   |

`lib/getErrorMessage(error)` maps `kind` (or a server validation message) to
user-facing copy; `getFieldErrors(error)` extracts field issues for forms.

## Result helpers (`src/core/api/result.ts`)

For call sites that prefer branching over `try/catch`:

```ts
import { toResult, isErr } from "@/core/api";

const result = await toResult(studentService.create(input));
if (isErr(result)) {
  // result.error is an ApiError
} else {
  // result.value is the created entity
}
```

`Result<T>`, `ok`, `err`, `isOk`, `isErr`, and `toResult` are exported from
`@/core/api`.

## Flow summary

```
axios → interceptor → success: unwrap ApiResponse → data
                    → failure: normalize → throw ApiError
                                              ↘ toResult → Result<T>
                                              ↘ QueryProvider → toast
                                              ↘ applyServerFieldErrors → form
```

No business logic lives in this layer — only transport and shape normalization.
