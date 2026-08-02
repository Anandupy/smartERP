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

A bare object with no `data` key is treated as the payload itself, so existing
controllers that return a plain entity keep working.

---

## 4. Swagger

Response schemas are generated from handler return types, which describe the
**payload** — not the envelope the interceptor actually sends.

`applyResponseEnvelope` rewrites the finished OpenAPI document in `main.ts`:

- 2xx responses become the envelope with the declared schema nested under
  `data`.
- Non-2xx responses become `$ref: ResponseEnvelope`, replacing Nest's default
  error schemas, which did not match what the filter sends.
- `ResponseEnvelope` and `ErrorEnvelope` are registered as components.

Transforming the document rather than decorating handlers is deliberate: the
alternative is a decorator on roughly two hundred handlers, where one omission
silently reintroduces the drift this is meant to remove.

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
