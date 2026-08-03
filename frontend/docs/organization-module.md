# Organization Module

The platform's tenants — the trusts and groups the ERP is multi-tenanted
around. `src/features/organization`, wired from
`backend/docs/modules/organization-settings.md` (titled "Organization Module";
it documents the entity, not a separate settings resource) and the Postman
collection.

Related: [Administration Modules](./administration-modules.md) ·
[Backend Contract Gaps](./backend-gaps.md) ·
[Dashboard Shell](./dashboard-shell.md)

---

## Endpoints

All five documented endpoints are wired.

| Endpoint                    | Status | Note                                            |
| --------------------------- | ------ | ----------------------------------------------- |
| `POST /organizations`       | Wired  | Super-admin only per the documented role matrix |
| `GET /organizations`        | Wired  | Documented as listing **active** organizations  |
| `GET /organizations/:id`    | Wired  |                                                 |
| `PATCH /organizations/:id`  | Wired  | Full body — no partial update is documented     |
| `DELETE /organizations/:id` | Wired  | **Soft delete** → marks the record `INACTIVE`   |

The service is written out rather than built from `createResourceService`, for
the same reason the maintenance service is: the list endpoint documents no
query parameters, and the factory would append `?page=…&pageSize=…` to every
request, inventing query contract on the wire.

---

## Three facts that shape the whole module

**1. The list returns active organizations only.**
So no screen reports a platform-wide total, and no screen derives an inactive
or suspended count. The dashboard's first tile is labelled "Listed" — what the
endpoint returned — not "Total". Filtering the directory to Inactive
legitimately yields nothing, and the empty state says why rather than leaving
the user to guess whether none exist or none were ever sent.

**2. `status` is server-managed.**
It is a documented field of the _entity_ and of _neither request body_. There
is therefore no status control anywhere in this module, and
`toOrganizationRequest` sends exactly fourteen fields — a unit test asserts the
exact key set, because a `status` leaking into a request is the kind of bug
that only shows up as a silently ignored field.

**3. `DELETE` is a soft delete.**
The documentation is explicit that the record is preserved. Every piece of copy
says "deactivate"; the confirmation dialog states that data survives and does
_not_ claim the action is irreversible. Overstating a consequence is its own
inaccuracy, and it is the kind that stops people doing legitimate work. What it
_does_ say is the part that matters: every branch and user underneath loses
access, and no documented endpoint reverses it.

---

## Screens

| Screen    | Route                               | Notes                                          |
| --------- | ----------------------------------- | ---------------------------------------------- |
| Dashboard | `/app/organizations`                | Counts, expiring subscriptions, activity trail |
| Directory | `/app/organizations/directory`      | `DataTable`, client-side query                 |
| Create    | `/app/organizations/new`            | Fourteen documented fields                     |
| Details   | `/app/organizations/[id]`           | Read-only, per-record activity trail           |
| Edit      | `/app/organizations/[id]/edit`      | Same form as create                            |
| Lifecycle | `/app/organizations/[id]/lifecycle` | Stage timeline + danger zone                   |

The root is the overview and `directory` the full list — the same split System
Settings uses. Lifecycle is its own screen because the operational state of a
tenant is a different decision from its details and should not sit beside a
name field.

**"Organization States" is not a route.** Loading, empty, error, success and
Backend Pending are states of the real screens, each built from the existing
shared components (`FormSkeleton`, `EmptyState`, `ApiErrorState`, Sonner
toasts, `BackendPendingBadge`/`Note`) and each covered by an integration test.
A gallery route would demonstrate states no user ever reaches by that path.

---

## The lifecycle screen

The design asks for five stages — Draft, Active, Suspended, Expired, Deleted.
The contract supports **two** transitions. Rather than drop the stages (hiding
a gap the backend team needs to see) or simulate them (this app deciding what
"suspended" means, and the backend later having to match a state machine it
never agreed to), the timeline renders all five in the design's order and marks
each unsupported one with its reason:

| Stage       | Reality                                                  |
| ----------- | -------------------------------------------------------- |
| Draft       | No status value, no endpoint, no field. Backend Pending. |
| Active      | Reachable — a created organization starts here.          |
| Suspended   | The status value is documented; **nothing sets it**.     |
| Expired     | Not a status. `masterExpiryDate` is a documented _date_. |
| Deactivated | `DELETE /organizations/:id`. Wired.                      |

`utils/organization-lifecycle.ts` holds that model, and the expiry helpers are
the one place a date is read. Whether `masterExpiryDate` has passed is a fact
about a documented field, so the UI shows it — as a date, in its own banner,
never sitting where a status belongs. An organization past its expiry still has
whatever `status` the backend reported, and the copy says so explicitly.

---

## Reuse

Nothing in this module duplicates existing infrastructure:

- **Table** — `DataTable` + `DataTableToolbar` + `DataTablePagination` +
  `DataTableColumnHeader` from `shared/components/data`.
- **Forms** — `useZodForm`, `TextField`, `applyServerFieldErrors` from the form
  platform.
- **States** — `FormSkeleton`, `EmptyState`, `ApiErrorState`,
  `BackendPendingBadge`/`Note`, `Banner` from `shared/components/feedback`.
- **Overlays** — `ConfirmDialog` from `shared/components/overlay`.
- **Display** — `StatCard`, `StatusBadge`, `DescriptionList`.

The two components this module _does_ add are genuinely domain-specific:
`OrganizationStatusBadge` (deciding that `SUSPENDED` reads as a warning is
domain knowledge the shared badge must not hold) and `OrganizationBoundary`
(the four states of "we need one organization", resolved once for the three
screens that need it — the same pattern as `SettingsBoundary`).

One change landed **outside** the module: `AuditFilters` gained `aggregateId`,
a documented audit filter parameter with no control of its own. The details
screen pins it so a record's timeline is scoped on the server rather than in
the browser.

---

## Cross-feature composition

Activity trails come from the audit module, wired at the route:

```tsx
<AuditExplorer
  fixedFilters={{ module: "ORGANIZATION", aggregateId: id }}
  lockedFilters={["module"]}
  showAnalytics={false}
/>
```

The audit contract records organization events under the `ORGANIZATION` module
(`organization.created`, `organization.updated`, `organization.deleted`), so
the trail is real. Neither feature imports the other — the fourth place in this
codebase where two features meet through a slot.
