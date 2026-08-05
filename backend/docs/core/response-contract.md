# Response Contract

Every response from the API — success or failure — has the same shape. A client
reads `success` and never has to guess which of two structures it received.

---

## 1. The envelope

```json
{
  "success": true,
  "message": "Branch created successfully",
  "data": { "id": "…", "name": "Main Campus" },
  "meta": {},
  "error": null,
  "requestId": "019fc2a1-0d7c-76cd-86ec-cbdf1628a566",
  "timestamp": "2026-08-02T12:34:56.789Z"
}
```

```json
{
  "success": false,
  "message": "Workspace setup is incomplete. Complete the setup flow before using this endpoint.",
  "data": null,
  "meta": {},
  "error": {
    "code": "SETUP_REQUIRED",
    "details": {
      "setupStage": "BRANCH",
      "missingResources": ["BRANCH", "ACADEMIC_YEAR"],
      "allowedActions": [{ "action": "CREATE_BRANCH", "…": "…" }]
    }
  },
  "requestId": "019fc2a1-0d7c-76cd-86ec-cbdf1628a566",
  "timestamp": "2026-08-02T12:34:56.789Z"
}
```

| Field       | Success                                | Failure                     |
| :---------- | :------------------------------------- | :-------------------------- |
| `success`   | `true`                                 | `false`                     |
| `message`   | Human-readable summary                 | Human-readable summary      |
| `data`      | The payload                            | `null`                      |
| `meta`      | Pagination and envelope-level metadata | `{}`                        |
| `error`     | `null`                                 | `{ code, details }`         |
| `requestId` | Correlates with server logs            | Correlates with server logs |
| `timestamp` | ISO 8601                               | ISO 8601                    |

Exactly one of `data` and `error` is populated.

---

## 2. What changed and why

The two halves of the contract used to disagree:

|             | Old success                           | Old failure                                    |
| :---------- | :------------------------------------ | :--------------------------------------------- |
| Shape       | `success, message, data, meta, error` | `success, code, message, requestId, timestamp` |
| `requestId` | absent                                | present                                        |
| `error`     | always `null`                         | absent                                         |
| Error code  | —                                     | top-level `code`                               |

A client could not read `requestId` from a successful response, so a user
reporting a wrong-but-successful result had no correlation id to quote. And
`error` was permanently `null` on success while never appearing on failure — the
one field that should have carried the failure never did.

**Structured errors were being discarded.** `GlobalExceptionFilter` reduced a
thrown payload to its `message`. Both of the API's recoverable-state responses
depend on carrying more than that:

- `CONTEXT_SELECTION_REQUIRED` sends `availableOrganizations`,
  `availableBranches`, `availableAcademicYears` so the client can prompt for a
  choice.
- `SETUP_REQUIRED` sends `setupStage`, `missingResources`, `allowedActions`.

None of it reached the client. Both features were documented as returning data
the filter deleted on the way out. They are now preserved under `error.details`.

### Compatibility

- All previously present fields keep their names, positions and meanings.
- `requestId`, `timestamp` and a populated `error` are **added** to responses
  that lacked them.
- The top-level `code` on failures moves to `error.code`. This is the one
  breaking change; it was necessary to make failure a strict superset of the
  success envelope rather than a parallel structure.

### Error codes

`error.code` is:

1. The payload's own `error` field when it is a `SCREAMING_SNAKE` machine code —
   `SETUP_REQUIRED`, `CONTEXT_SELECTION_REQUIRED`, `SETUP_INCOMPLETE`.
2. Otherwise the exception's class name — `NotFoundException`,
   `ForbiddenException`.

Nest fills `error` with a reason phrase (`"Not Found"`, `"Bad Request"`) on its
built-in exceptions, so the `SCREAMING_SNAKE` test is what stops those replacing
the class names that clients already see. Codes emitted before this change are
unchanged.

Prisma failures keep their translated codes from `PrismaErrorTranslator`.
Maintenance windows return `MAINTENANCE_ACTIVE` with the rule in
`error.details`.

---

## 3. Controllers

Return `{ data, message, meta }` — any subset. `GlobalResponseInterceptor`
wraps it:

```typescript
return { data, message: 'Branch created successfully' };
```

Only a **plain object** can carry that convention. Anything else — an array, a
primitive, a `Date` — is treated as the payload itself, as is a plain object
with no `data` key, so a controller that returns a bare entity keeps working.

The array case used to be wrong: an array passed the `typeof === 'object'`
test and was spread into the envelope, so a list of rows arrived as
`{"0": …, "1": …}` while an empty list stayed an array. Six endpoints returned
two different types depending on how many rows they found. `isPlainObject` now
gates the destructuring.

A handler that returns a complete envelope of its own is passed through
untouched rather than wrapped a second time.

---

## 4. Swagger

Response schemas are generated from handler return types, which describe the
**payload** — not the envelope the interceptor actually sends. Two mechanisms
close that gap, and they work together.

### Per-handler decorators

`src/common/http/api-envelope-response.decorator.ts` builds the whole envelope
with a DTO nested under `data`:

```typescript
@ApiOkEnvelope(ProgramDto, { message: 'Program retrieved successfully' })
@ApiStandardErrors(404)
```

| Decorator                     | Documents                                            |
| :---------------------------- | :--------------------------------------------------- |
| `ApiOkEnvelope(Dto)`          | `200` with the DTO under `data`                       |
| `ApiCreatedEnvelope(Dto)`     | `201` with the DTO under `data`                       |
| `ApiEmptyEnvelope()`          | `data: null` — delete, logout, activate               |
| `ApiPaginatedEnvelope(Dto)`   | `data` is the page, pagination on the envelope `meta` |
| `ApiPaginatedItemsEnvelope(Dto)` | `data` is `{ items, meta }`                        |
| `ApiPaginatedDataEnvelope(Dto)`  | `data` is `{ data, meta }`                         |
| `ApiStandardErrors(…)`        | `400`, `401`, `403`, `500` plus any extra codes       |
| `ApiPublicErrors(…)`          | the same minus `401`/`403`, for public endpoints      |

Options: `isArray`, `nullable`, `message`, `description`, `status`, `meta`.

**Which pagination decorator** depends on what the controller does with the
service result, not on convention. A controller that returns the result
unchanged lets the interceptor lift `meta` onto the envelope; one that wraps it
in `{ data: result }` leaves the pagination nested under `data`. Both happen in
this codebase, so both are documented as they actually behave.

### The document transform

`applyResponseEnvelope` still rewrites the finished document in `main.ts`:

- 2xx responses the decorator already enveloped are marked and skipped.
- Any other 2xx response is wrapped, so an endpoint nobody decorated still
  shows the correct outer shape instead of silently drifting.
- Non-2xx responses become `$ref: ResponseEnvelope`, replacing Nest's default
  error schemas, which did not match what the filter sends.
- `ResponseEnvelope` and `ErrorEnvelope` are registered as components.

Both build the envelope from one shared builder in `envelope-schema.ts`, so
they cannot describe it differently.

### Checking coverage

```
pnpm openapi:audit
```

Boots the app, generates the document, and reports every operation whose
payload or failure responses are undocumented, plus any schema property with no
concrete type.

### Nullable properties need an explicit type

TypeScript reflects `string | null` as `Object`, so this emits
`type: "object"`:

```typescript
@ApiProperty({ nullable: true })
middleName!: string | null;   // ✗ documented as an object
```

State the type:

```typescript
@ApiProperty({ type: String, nullable: true })
middleName!: string | null;   // ✓
```

---

## 5. Adding an error with structured detail

Throw an `HttpException` whose payload carries a `SCREAMING_SNAKE` `error` and
whatever the client needs to recover:

```typescript
throw new ConflictException({
  error: 'SETUP_REQUIRED',
  message: 'Workspace setup is incomplete.',
  setupStage: 'BRANCH',
  missingResources: ['BRANCH', 'ACADEMIC_YEAR'],
});
```

`message`, `error` and `statusCode` are lifted into the envelope; every other
key lands in `error.details`.
