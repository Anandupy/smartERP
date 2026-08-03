# Administration Modules

The first three business modules on the platform: **System Settings**,
**Maintenance** and **Audit Logs**, plus the **dashboard shell** they render
inside. This document records what each is wired to, and — just as importantly —
what it is not, and why.

Related: [Dashboard Shell](./dashboard-shell.md) ·
[Backend Contract Gaps](./backend-gaps.md) ·
[Response Handling](./response-handling.md)

---

## The contract-driven rule

Every request this app makes is transcribed from `backend/docs/` and the Postman
collection. Nothing is inferred. Where a contract is missing, the screen still
ships — laid out, validated, wired to its query hooks — but its writes stay
disabled and it says so, through
`BackendPendingBadge` / `BackendPendingNote` from `shared/components/feedback`.

Searching the source for `BACKEND_PENDING_LABEL` enumerates every place still
waiting on the backend. The full inventory lives in
[Backend Contract Gaps](./backend-gaps.md).

Two consequences run through the code:

- **DTOs record their source.** Each `types/*.dto.ts` names which document each
  field came from, and marks anything absent from the documented data structure
  as optional rather than assumed.
- **Undocumented responses are read defensively, never typed.** Two endpoints
  document a _purpose_ and no response body. Their payloads are typed `unknown`
  and narrowed by a reader that accepts the shapes a backend plausibly returns
  and reports `isUnrecognized` otherwise. A wrong guess degrades to a visible
  "Backend Pending" marker — never to a fabricated figure.

---

## System Settings (`features/system-settings`)

The installation's global configuration: one singleton record at
`/system-settings`.

| Endpoint                     | Status |
| ---------------------------- | ------ |
| `GET /system-settings`       | Wired  |
| `PATCH /system-settings`     | Wired  |
| `POST /system-settings/init` | Wired  |

Because the resource is a singleton — no id, no list, no delete — the service is
written out rather than built from `createResourceService`, whose CRUD shape
would misdescribe it.

### One record, two screens

General Settings edits product identity; Maintenance & Support edits the
maintenance switch and support channels. The backend documents **no partial
update**, so every write reconstructs the _complete_ documented body from the
loaded record plus the user's edits. That is what
`toGeneralUpdateRequest(current, values)` is for, and why it takes the loaded
record as well as the form values: editing identity can never blank out a
support address entered on the other screen.

`SettingsBoundary` resolves the four states of "we need the settings record"
once — loading, not-initialized, failed, loaded — so five screens do not each
re-decide what a `404` means. A `404` is the installation's _not set up yet_
state and offers initialization; anything else is a real failure.

### Screens

| Screen                | Backend                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| Overview              | Wired — status strip from the record                                   |
| General Settings      | Wired                                                                  |
| Maintenance & Support | Wired                                                                  |
| System Information    | Partly wired — configured values wired, infrastructure metrics pending |
| Branding & Identity   | **Backend Pending in full** — no fields, no upload endpoint            |
| History & Audit       | Wired, via the audit module (see below)                                |

---

## Maintenance (`features/maintenance`)

Scoped, schedulable rules at `/maintenance-rules`, evaluated by the backend's
`MaintenanceGuard` on every request. **Distinct from** the installation-wide
`maintenanceMode` flag on the settings record — the copy on both screens says so,
because two screens with "maintenance" in the title is exactly where an operator
turns off more than they meant to.

All five CRUD endpoints are wired. Two gaps shape the module:

- **The list endpoint documents no query parameters.** Search, filtering and
  paging therefore run in the client, over the whole collection, and the screen
  states that plainly. The service is written out rather than built from
  `createResourceService` precisely so that no `?page=1&pageSize=20` is invented
  on every request.
- **`GET /maintenance-rules/active/status` documents no response body.** It is
  typed `unknown` and narrowed by `readActiveStatus`, which reads only field
  names the rule table already defines, accepts `null`/`{}` as "nothing active",
  and reports `isUnrecognized` otherwise. An unreadable payload is surfaced as
  pending — never as "all clear".

### The preview

`MaintenanceRulePreview` renders the rule from the form as it is filled in,
using the same `MaintenanceBanner` the live notice uses. The thing being
configured is whether people can use the system, and the cost of discovering a
mistake afterwards is that nobody can reach the screen to undo it.

---

## Audit Logs (`features/audit`)

Read-only, at `/audit-logs`. Records are written by the backend's event
listener; no client ever writes one.

The **query** side is the best-documented contract in this milestone —
pagination, four sort fields, fifteen filters, keyword search — and is fully
wired. This module does **no** client-side filtering, unlike maintenance.

| Endpoint                   | Status                                      |
| -------------------------- | ------------------------------------------- |
| `GET /audit-logs`          | Wired, server-paginated and server-filtered |
| `GET /audit-logs/:id`      | Wired                                       |
| `GET /audit-logs/summary`  | Called; response shape undocumented         |
| `GET /audit-logs/timeline` | Called; response shape undocumented         |
| Export                     | **No endpoint documented**                  |

`readSummary` and `readTimeline` accept every shape a grouped count plausibly
takes — `{SYSTEM: 4}`, `[{module, count}]`, `[{module, _count}]`, nested under
`byModule`/`modules` — and report `isUnrecognized` otherwise. The record total
falls back to `meta.pagination.total` from the list request, which _is_
documented, so the figure most likely to be read survives whatever the summary
shape turns out to be.

Tiles show an em dash, never a zero, when a distribution could not be read: on a
compliance screen a zero reads as "nothing happened" rather than "nothing was
returned".

### `AuditExplorer`

The reusable unit. System Settings' History screen is the same explorer pinned
to the `SYSTEM` module:

```tsx
<AuditExplorer
  fixedFilters={{ module: "SYSTEM" }}
  lockedFilters={["module"]}
  showAnalytics={false}
/>
```

Composed at the route, so neither feature imports the other.

---

## Cross-feature composition

Three places where two features meet. In every one the joining happens at the
**route**, never through a feature importing another feature:

| Route                | Composition                                                  |
| -------------------- | ------------------------------------------------------------ |
| `(app)/layout.tsx`   | navigation supplies the shell, auth supplies `SignOutButton` |
| `(app)/app/page.tsx` | dashboard supplies the layout, settings supplies the notice  |
| `settings/history`   | settings supplies the heading, audit supplies the explorer   |

This is the arrangement authentication and workspace selection already use, and
it is what keeps `features/*` genuinely independent as more modules land.

---

## Testing

- **Unit** (`tests/unit`) — the pure logic: mappers, schemas, and every
  defensive reader against every payload shape it must survive. These import
  the _module_ under test rather than the feature barrel, so a test for
  `readSummary` does not load a data table.
- **Integration** (`tests/integration`) — screens through MSW, asserting on what
  reaches the wire: that a partial edit still sends a complete body, that the
  maintenance list sends no query parameters, that the audit list sends the
  documented ones.
- **Fixtures** (`tests/fixtures`) carry only documented fields, so a test cannot
  pass against a property the backend never promised.
