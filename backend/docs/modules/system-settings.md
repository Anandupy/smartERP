# System Settings Module

The System Settings module is the ERP's global configuration layer. It stores
identity and support information for the deployment and carries a coarse
maintenance switch.

**Singleton.** `POST /v1/system-settings/init` succeeds once; a second call is
rejected with `409`. Every read afterwards returns the same row.

---

## Features

- **One-time initialization** — the system can only be initialized once.
- **Global config** — product name, code, version and environment.
- **Maintenance mode** — a global flag with a custom message. Distinct from the
  [Maintenance Rules](./maintenance.md) module, which is scoped and scheduled;
  this one is a single switch over the whole deployment.
- **Support info** — global support email and phone.
- **Tenant defaults** — timezone, currency and language, applied where a tenant
  has not overridden them.
- **RBAC protected** — `SUPER_ADMIN` only, enforced by `RolesGuard` against the
  JWT. See [Role access](#role-access).

---

## Data structure

Every field of the response, as `SystemSettingsDto` documents it in Swagger.

| Field                | Type                    | Notes                                            |
| :------------------- | :---------------------- | :----------------------------------------------- |
| `id`                 | `string` (uuid v7)      |                                                  |
| `productName`        | `string`                |                                                  |
| `productCode`        | `string`                | Unique.                                          |
| `version`            | `string`                |                                                  |
| `environment`        | `DEV \| STAGING \| PROD` |                                                 |
| `maintenanceMode`    | `boolean`               | Default `false`.                                 |
| `maintenanceMessage` | `string \| null`        |                                                  |
| `defaultTimezone`    | `string`                | Default `Asia/Kolkata`. **Read-only** — see below. |
| `defaultCurrency`    | `string`                | Default `INR`. **Read-only** — see below.        |
| `defaultLanguage`    | `string`                | Default `en-IN`. **Read-only** — see below.      |
| `supportEmail`       | `string`                |                                                  |
| `supportPhone`       | `string`                |                                                  |
| `isActive`           | `boolean`               | Default `true`.                                  |
| `createdBy`          | `string \| null`        | User id.                                         |
| `updatedBy`          | `string \| null`        | User id. This is the "last changed by".          |
| `createdAt`          | `string` (ISO 8601)     |                                                  |
| `updatedAt`          | `string` (ISO 8601)     |                                                  |

### Read-only fields

`defaultTimezone`, `defaultCurrency` and `defaultLanguage` are columns with
defaults and are **returned** on every read, but neither `CreateSystemDto` nor
`UpdateSystemDto` accepts them, so there is currently no way to change them
through the API. They are listed here because a client can display them; it
cannot yet edit them.

---

## API endpoints

| Method  | Path                       | Description                                    |
| :------ | :------------------------- | :--------------------------------------------- |
| `POST`  | `/v1/system-settings/init` | Initialize the settings. Succeeds once.        |
| `GET`   | `/v1/system-settings`      | Read the current settings.                     |
| `PATCH` | `/v1/system-settings`      | Update the settings. **Accepts a partial body.** |

### Partial updates

`UpdateSystemDto extends PartialType(CreateSystemDto)`, so every field is
optional on `PATCH`. Send only what is changing; omitted fields are left alone.
There is no need to read the record and resend it whole.

### Validation

Enforced by `class-validator` on `CreateSystemDto`, and on `PATCH` for whichever
fields are present:

| Field                | Rule                                     |
| :------------------- | :--------------------------------------- |
| `productName`        | non-empty string                         |
| `productCode`        | non-empty string                         |
| `version`            | non-empty string                         |
| `environment`        | one of `DEV`, `STAGING`, `PROD`          |
| `maintenanceMode`    | boolean, required                        |
| `maintenanceMessage` | optional string                          |
| `supportEmail`       | valid email address                      |
| `supportPhone`       | non-empty string                         |

No length, pattern or format rule is imposed beyond these. `productCode`
uniqueness is enforced by the database, surfacing as a `409`.

---

## Role access

- **SUPER_ADMIN** — full access (read / write / init).
- **Others** — no access.

Enforced by `RolesGuard` reading the role from the JWT. **No `x-role` header is
involved.** An earlier version of this document described one; the platform has
never read that header, and sending it has no effect.

---

## Response contract

Every response uses the shared envelope — see
[Response Contract](../core/response-contract.md). Success payloads are
`SystemSettingsDto`; failures carry `error.code`.

| Status | When                                                    |
| :----- | :------------------------------------------------------ |
| `200`  | Read or update succeeded.                                |
| `201`  | Initialization succeeded.                                |
| `400`  | Validation failed.                                       |
| `401`  | Missing or invalid credentials.                          |
| `403`  | Authenticated but not `SUPER_ADMIN`.                     |
| `404`  | Read or update before initialization.                    |
| `409`  | `init` called when settings already exist.               |
| `500`  | Unexpected server error.                                 |

---

## Not in this module

The following have no field and no endpoint here. They are recorded so a reader
does not go looking:

- Branding — logo, favicon, icon, colours. No upload endpoint exists anywhere.
- Date-format preference. Timezone, currency and language exist; date format
  does not.
- Security policy — 2FA enforcement, session timeout, IP allowlisting.
- Infrastructure metrics — build id, deployment region, node inventory,
  licence tier. **Uptime and database health are available**, from the
  [health probes](../core/health-and-lifecycle.md): `GET /live` reports
  `uptimeSeconds`, and `GET /health` reports database and heap indicators.
