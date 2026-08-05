# Branch Settings

**There is no branch settings resource.** No entity, no endpoint, no request or
response contract. This file exists because its name has been read as a promise
that one does.

Every endpoint under `/v1/branches` operates on the **branch record itself** —
see [Branch Module](./branch.md), which is the complete contract for it.

---

## Why this file is named this way

It previously held a second, partial copy of the branch entity's documentation:
a data-structure table and a seven-endpoint list, under the heading "Branch
Module". [`branch.md`](./branch.md) held a different partial copy — the guard
pipeline, the institution types, and five of the same seven endpoints. Neither
was complete, and a reader who found one did not know to look for the other.

Both have been merged into [`branch.md`](./branch.md). This file is kept as a
pointer so existing links keep working, and so the question it raises gets a
written answer rather than being inferred from an empty file.

---

## What a branch settings module would need

Nothing below exists. It is listed so that a reader can tell at a glance that
the absence is total rather than partial, and so a future implementation has a
starting inventory:

| Missing | Detail |
| :--- | :--- |
| **Entity** | No resource, no id, no shape. |
| **Endpoints** | No read, no write, no reset-to-defaults. |
| **Request contracts** | No body for any section. |
| **Response contracts** | Nothing to type against. |
| **Validation** | No lengths, formats, ranges or vocabularies. |

The fields a settings module has been asked for, none of which has a column:
working hours, holiday calendar, locale / date / currency format, grading
system, passing threshold, academic cycle, attendance policy and thresholds,
biometric integration, email and SMS gateway, sender identity, push
notifications, SSO, IP allowlist, session timeout, encryption standard, LMS
provider and sync, API credentials, webhooks.

Some of these overlap resources that **do** exist and should not be duplicated
if a settings module is ever built:

- **Email / SMS gateway, sender identity, push notifications** — the
  [Communication module](./communication/communication.md) already owns provider
  configuration, per-scope channel switches and templates, at
  `/v1/communication/settings`. It is scoped by organization and branch.
- **Locale and currency defaults** — [System Settings](./system-settings.md)
  holds `defaultTimezone`, `defaultCurrency` and `defaultLanguage` at the
  deployment level. There is no per-branch override.
- **Academic cycle** — [Academic Years](./academic-year.md) owns the session
  calendar.

---

## Change history for a branch

Available today, without a settings resource: branch writes publish
`branch.created`, `branch.updated` and `branch.deleted`, which the
[audit trail](../core/audit.md) records. Query them with
`GET /v1/audit-logs?aggregateType=Branch&aggregateId=<id>`.
