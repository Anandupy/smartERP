# Organization Module

The Organization module handles multi-tenancy by managing different clients (Trusts/Groups) within the ERP system.

## Features
- **Identity Management**: Stores organization name, logo, and unique code.
- **Contact Info**: Stores primary contact email and phone.
- **Address Details**: Full physical address including city, state, country, and pincode.
- **Subscription Lifecycle**: Tracks `masterExpiryDate` and `status` (ACTIVE, INACTIVE, SUSPENDED).
- **Soft Delete**: Organizations are marked as `INACTIVE` instead of being permanently removed.
- **RBAC Protected**: Access is restricted based on user roles.

## Data Structure

Every field of the response, as `OrganizationDto` documents it in Swagger. The
service performs no projection, so every column reaches the client.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `name` | `String` | Required. |
| `code` | `String` | Required. Unique, slug-safe lowercase. |
| `logoUrl` | `String?` | Optional. A URL — there is no upload endpoint. |
| `contactEmail` | `String` | Required. |
| `contactPhone` | `String` | Required. |
| `addressLine1` / `addressLine2` | `String?` | Optional. |
| `city` / `state` / `country` / `pincode` | `String?` | Optional. |
| `masterExpiryDate` | `DateTime` | Required. ISO 8601 on the wire. |
| `status` | `OrganizationStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED`. **Read-only** — see below. |
| `timezone` | `String?` | Optional. |
| `currency` | `String?` | Optional. |
| `createdBy` / `updatedBy` | `String?` | User id. |
| `createdAt` / `updatedAt` | `DateTime` | ISO 8601. |

### `status` has no write path

`status` is returned on every read, but it is **not in `CreateOrganizationDto`**
and therefore not in `UpdateOrganizationDto`, which extends `PartialType` of it.
No endpoint sets it except `DELETE`, which sets `INACTIVE`.

Two consequences, and they compound:

- **`SUSPENDED` is unreachable through the API.** The value exists in the enum
  and nothing can produce it.
- **A deactivation cannot be reversed, and the record disappears.** `DELETE`
  sets `INACTIVE`; the list excludes `INACTIVE`; no endpoint sets it back. From
  a client's point of view the organization is gone and cannot be restored.

### `masterExpiryDate` does not affect `status`

Expiry is a date and nothing more. No job, guard or service reads it, so an
organization past its `masterExpiryDate` stays `ACTIVE` and keeps working. Treat
it as a date to display, never as a state.

## API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/v1/organizations` | Create a new organization. |
| `GET` | `/v1/organizations` | List organizations. See the note below. |
| `GET` | `/v1/organizations/:id` | Get one organization, in any status. |
| `PATCH` | `/v1/organizations/:id` | Update. **Accepts a partial body.** |
| `DELETE` | `/v1/organizations/:id` | Deactivate — sets `status: INACTIVE`. |

Notes:

- **The list returns `ACTIVE` and `SUSPENDED`**, excluding only `INACTIVE`. It
  is not "active organizations only"; a suspended organization is listed.
- **No parameter widens the list** to include `INACTIVE`, so a deactivated
  organization is reachable only by `GET /:id`, with an id the client must
  already hold.
- **No query parameters** at all — no `page`, `limit`, `search`, `sortBy` or
  filters.
- `DELETE` returns the updated record, not `data: null`.

## Error Contracts

| Rule broken | Status | `error.code` | Message |
| :--- | :--- | :--- | :--- |
| `code` already taken | `409` | `ConflictException` | `Organization with this code already exists` |
| Organization does not exist | `404` | `NotFoundException` | `Organization not found` |

`code` is the only field with a documented rule — unique, slug-safe lowercase.
Nothing else has a length, pattern or vocabulary constraint.

## Not in this module

- **No permanent deletion** and no restore.
- **No lifecycle beyond create and deactivate** — no draft, no expiry
  transition, no reactivation.
- **No logo upload.** `logoUrl` is a string; nothing accepts a file.
- **No export, bulk actions or organization "type".**
- **No counts, stakeholders, tax id or licence tier** on the entity.

## Role Access
- **SUPER_ADMIN**: Full access to all operations.
- **ORG_ADMIN**: Read and Update access only.
- **Others**: No access.
