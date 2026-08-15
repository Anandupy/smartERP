# Communication Module — UI/UX Functional Specification

**Status:** this analysis has since been implemented as `src/features/communication`. Phase 1 (the ten admin screens: Overview, Templates Directory/Detail/Create/Edit, Template Preview drawer, Delivery Logs + detail drawer, Analytics, Settings, Send Notification) is live under `/app/communication/**`, wired against the same 18 endpoints this document catalogues. **Not implemented**: the Part 3 "personal surface" (Notification Inbox, Bell + Panel, Notification Preferences) — those endpoints are real and documented here but ship in a later phase, per the task that produced Phase 1. Every §13 Future Enhancement remains absent from the backend and therefore from the UI, shown (where surfaced at all) via `BackendPendingNote`.
**Sources:** `backend/src/modules/communication/**` (6 controllers, 18 routes), `backend/prisma/modules/communication/*.prisma` (7 models, 8 enums), `backend/docs/modules/communication/*.md` (10 documents), `backend/postman/erp.postman_collection.json` (18 Communication requests), and the shipped CampusFlow frontend (`src/components/ui`, `src/shared/components`, `src/features/*`).

---

## 0. Executive summary — read this before designing anything

The backend implements **one-third of what the word "Communication" usually implies**, and the difference decides whether the generated UI is usable or fiction.

**What exists (18 endpoints, all verified in source *and* Postman):**

| Area | Endpoints | Verdict |
| :-- | :-- | :-- |
| Templates | 5 | Full CRUD-minus-delete, plus server-side preview rendering |
| In-app notifications | 5 | Full inbox: list, create, read, read-all, archive |
| Delivery logs | 2 | Paginated log query + one flat analytics summary |
| Settings | 2 | Read + patch, scoped by org/branch |
| OTP | 2 | Generate + verify (unauthenticated) |
| Preferences | 2 | Read + patch, per-category channel toggles |

**What does NOT exist and must NOT be designed as working UI:**

- **No broadcast, campaign, or "send message" endpoint of any kind.** Nothing in the API sends an ad-hoc message. All dispatch is event-driven, internal, triggered by `CommunicationSubscriber` reacting to domain events. A "Compose Broadcast" screen would have no endpoint behind it.
- **No scheduling.** No cron, no send-at, no queue inspection endpoint. The `retry/` folder contains a strategy class with no controller.
- **No audience or recipient builder.** No endpoint returns a targetable recipient list.
- **No provider management API.** `ProviderConfig` is a Prisma model with **no controller, no service, no route** — and its schema carries an explicit warning that `credentials` is unencrypted and unread by any code. Provider *selection* exists (four `default*Provider` fields on settings); provider *configuration* does not.
- **No template delete, duplicate, publish-action, test-send, or version-history endpoint.** Publishing is `PATCH {status}`. Versioning is an integer field you set yourself; old versions stay addressable only because `code+channel+language+version` is unique.
- **No delivery-log detail endpoint, no retry-now action, no per-channel / per-provider / time-series analytics.** `GET /delivery-logs/analytics` returns six integers and three rates for an org/branch — **no date range, no channel filter, no buckets**.
- **No admin view of OTP tokens.** OTP is a machine-to-machine pair of endpoints.
- **No notification delete, unpin, or bulk-archive.** `isPinned` is settable at creation only.

Everything above is catalogued in [§13 Future Enhancements](#13-future-enhancements) and must be rendered, if at all, with the existing `BackendPendingBadge` / `BackendPendingNote` components — never as live controls.

---

## Part 1 — Module Overview

### Purpose

A centralised, reusable, multi-channel messaging platform (Email, SMS, WhatsApp, Push, In-App) plus decoupled OTP infrastructure. It is **infrastructure**, not a business module: it lives under `src/modules/communication` and is consumed by events, not by imports.

### Responsibilities

1. Own message **templates** and their multi-tenant resolution.
2. Own the **in-app notification centre** (persistent user inbox).
3. Own **per-user channel preferences** with a security override.
4. Record the operational **delivery lifecycle** of every outbound message.
5. Provide **OTP** generation/verification for seven business purposes.
6. Hold **channel and provider settings** per organization/branch.

### Role in the ERP — the Anti-Gravity boundary

Business modules never import `EmailService`. They publish domain events; `CommunicationSubscriber` subscribes. Verified subscriptions today:

| Event | Handler | Implemented? |
| :-- | :-- | :-- |
| `PasswordResetRequestedEvent` | `handlePasswordResetRequested` | **Yes** — resolves template, renders, dispatches, logs |
| `PasswordChangedEvent` | `handlePasswordChanged` | **Yes** |
| `EmailVerificationRequestedEvent` | `handleEmailVerificationRequested` | **Yes** |
| `OtpSentEvent` / `OtpResendRequestedEvent` | `handleOtpSent` | **Yes** |
| `user.logged_in` | `handleUserLoggedIn` | **Stub — logs a debug line only** |
| `applicant.created` | `handleApplicantCreated` | **Stub** |
| `admission.transitioned` | `handleAdmissionTransitioned` | **Stub** |

**UI consequence:** the module's live traffic today is overwhelmingly **AUTHENTICATION**-category email. Admissions/Fees/Academic categories exist in the enum and in template creation, but nothing yet emits them. Dashboards must therefore be honest about sparse data rather than designing for a busy multi-channel feed.

### Dependencies

`PrismaService` · core `EventBus` · `JwtAuthGuard` + `RolesGuard` · request context (org/branch) · Handlebars renderer · `ProviderFactory` (SMTP real; SMS/WhatsApp/Push are **stubs**).

### Who uses it

| Consumer | Surface |
| :-- | :-- |
| Platform/Org admins | Templates, Settings, Delivery Logs, Analytics |
| Every authenticated user | Notification inbox, Notification preferences |
| Unauthenticated clients | OTP generate/verify (public) |
| Other backend modules | Domain events only — never a UI |

### Relationships

- **Authentication** — the only fully wired producer (password reset, verification, OTP).
- **Admissions / Fees / Attendance / Examinations** — enum categories reserved; **no producers implemented**.
- **Parent / Student / Staff portals** — consume the inbox + preferences endpoints; those portals do not exist in this frontend yet.

---

## Part 2 — Feature Inventory

Grouped by what the API actually exposes. `✅` = endpoint exists. `🚫` = no endpoint.

### A. Templates — `/v1/communication/templates`
- ✅ Create template (`POST`) — `SUPER_ADMIN`, `ORG_ADMIN`
- ✅ List templates (`GET`) — filters: `channel`, `status`, `search` — `+BRANCH_ADMIN`
- ✅ Get one (`GET /:id`)
- ✅ Update (`PATCH /:id`) — partial; status change is how you publish/archive
- ✅ Preview render (`POST /preview`) — by `templateId`, or `code` + `?channel`; returns `{subject?, bodyHtml?, bodyText?, missingVariables[]}`
- 🚫 Delete · duplicate · version history · test-send · bulk actions

### B. In-App Notifications — `/v1/communication/notifications`
- ✅ List mine (`GET`) — `page`, `limit`, `status`, `category`, `priority`, `isPinned`, `search`; **envelope `meta` carries `unreadCount`** for the badge
- ✅ Create (`POST`) — admin/service; `userId` is required, so it is a **single-recipient** tool, not a broadcast
- ✅ Mark read (`PATCH /:id/read`) · ✅ Mark all read (`PATCH /read-all`) → `{count}` · ✅ Archive (`PATCH /:id/archive`)
- 🚫 Delete · unpin · bulk archive · unread-only counter endpoint

### C. Delivery Logs — `/v1/communication/delivery-logs`
- ✅ Query (`GET`) — `page`, `limit`, `channel`, `status`, `provider`, `recipient`, `startDate`, `endDate`, `organizationId`, `branchId`; **pagination on the envelope's `meta`**
- ✅ Analytics (`GET /analytics`) — only `organizationId`, `branchId`
- 🚫 Detail endpoint · retry · resend · export · webhook ingestion

### D. Settings — `/v1/communication/settings`
- ✅ Get (`GET ?organizationId&branchId`) — **returns defaults instead of 404** when unset
- ✅ Update (`PATCH`) — 8 booleans + 4 provider selections
- 🚫 Test connection · reset to default · change history

### E. OTP — `/v1/communication/otp`
- ✅ Generate (`POST /generate`) → `{otpTokenId, expiresAt, resendAvailableAt}` — **the code is never returned**
- ✅ Verify (`POST /verify`)
- 🚫 Resend endpoint (re-call generate; cooldown enforced) · revoke · admin listing

### F. Preferences — `/v1/communication/preferences`
- ✅ Get mine (`GET`) — **all six categories always returned**; untouched ones come back with a synthetic id that cannot be addressed
- ✅ Update one category (`PATCH`) — five channel booleans
- 🚫 Bulk update · per-channel global mute · quiet hours

### G. Not exposed at all
Providers CRUD · broadcast/compose · scheduling · queues · automation · approvals · A/B testing · export.

---

## Part 3 — Screen Inventory

**12 screens, 6 dialogs/drawers, 1 wizard-style form.** Every one is backed by a live endpoint.

| # | Screen | Route | Endpoint(s) | Roles |
| :-- | :-- | :-- | :-- | :-- |
| 1 | Communication Overview | `/app/communication` | analytics + settings + templates(list) | Admins |
| 2 | Templates Directory | `/app/communication/templates` | `GET /templates` | S/O/B admin |
| 3 | Template Detail | `/app/communication/templates/[id]` | `GET /templates/:id` | S/O/B admin |
| 4 | Template Create | `/app/communication/templates/new` | `POST /templates` | S/O admin |
| 5 | Template Edit | `/app/communication/templates/[id]/edit` | `PATCH /templates/:id` | S/O admin |
| 6 | Delivery Logs Explorer | `/app/communication/delivery-logs` | `GET /delivery-logs` | S/O/B admin |
| 7 | Delivery Analytics | `/app/communication/analytics` | `GET /delivery-logs/analytics` | S/O/B admin |
| 8 | Communication Settings | `/app/communication/settings` | `GET`/`PATCH /settings` | S/O/B(read) |
| 9 | Notification Inbox | `/app/notifications` | `GET /notifications` + actions | Every user |
| 10 | Notification Preferences | `/app/notifications/preferences` | `GET`/`PATCH /preferences` | Every user |
| 11 | Send Notification (single user) | `/app/communication/notifications/new` | `POST /notifications` | Admins |
| 12 | Notification Bell + Panel | global top-nav | `GET /notifications?limit=…` | Every user |

**Dialogs & drawers**
- D1 Template Preview drawer (`POST /templates/preview`) — variables form ➝ rendered output ➝ `missingVariables` warning
- D2 Publish / Archive confirm dialog (`PATCH` status) — states the resolution consequence
- D3 Delivery Log detail drawer — **client-side only, from the row already loaded** (no detail endpoint)
- D4 Mark-all-read confirm
- D5 Settings "disable a channel" confirm — a disabled channel silently stops delivery
- D6 Unsaved-changes guard on the template editor

**States** — every screen ships loading / empty / error / forbidden using `shared/components/feedback`: `LoadingState`, `EmptyState`, `ApiErrorState`, `ForbiddenState`, `Skeletons`.

---

## Part 4 — Entity Analysis

### 4.1 CommunicationTemplate
`id · organizationId? · branchId? · code · name · description? · channel · category · subject? · bodyHtml? · bodyText? · variables(Json) · language="en" · version=1 · status=DRAFT · isDefault=false · metadata? · createdBy/updatedBy · createdAt/updatedAt`
- **Unique:** `(organizationId, branchId, code, channel, language, version)` → same code can exist per scope, channel, language **and version**.
- **Scope semantics:** both ids null = global default · org set, branch null = tenant-wide · both set = branch-specific.
- **Lifecycle:** `DRAFT → PUBLISHED → ARCHIVED` (any transition via `PATCH status`; nothing enforces direction).
- **Resolution order (matters in the UI):** branch+published → org+published → global+published → **any status, latest version** as a last resort.
- **`variables` is `string[] | Record<string,unknown> | null`** — the UI must handle both.

### 4.2 InAppNotification
`id · organizationId? · branchId? · userId · title · content · category=SYSTEM · priority=NORMAL · status=UNREAD · actionUrl? · metadata? · expiresAt? · isPinned=false · readAt? · archivedAt? · timestamps`
- Ordering: `isPinned desc, createdAt desc`.
- `expiresAt` exists on the model but **no DTO sets it** — read-only in practice.

### 4.3 DeliveryLog
`id · org/branch · channel · provider · recipient · sender? · subject? · templateId? · templateVersion? · status=PENDING · latencyMs? · retryCount=0 · errorCode? · errorMessage? · openedAt? · clickedAt? · deliveredAt? · sentAt? · metadata? · timestamps`
- **No foreign keys** — deliberate, for analytical write throughput. `templateId` is a loose reference: the UI must not assume the template still exists.
- Status machine: `PENDING → QUEUED → SENT → DELIVERED → OPENED → CLICKED`, with `FAILED`/`BOUNCED`/`RETRIED` branches.

### 4.4 CommunicationSetting
`org?/branch? (unique together) · emailEnabled · smsEnabled · whatsappEnabled · pushEnabled · otpEnabled · trackingEnabled · analyticsEnabled · retryEnabled` (all default `true`) · `defaultEmailProvider=SMTP · defaultSmsProvider=CUSTOM · defaultWhatsappProvider=CUSTOM · defaultPushProvider=CUSTOM`

### 4.5 NotificationPreference
`userId + category` unique · five channel booleans, all default `true`. **Security override:** `AUTHENTICATION` opt-outs are ignored at dispatch — the UI must say so.

### 4.6 OtpToken *(no read API — modelled for completeness)*
`identifier · otpHash(SHA-256) · purpose · attempts=0 · maxAttempts=5 · expiresAt · resendAvailableAt · isUsed · isRevoked · usedAt · revokedAt`

### 4.7 ProviderConfig *(no API — do not design CRUD)*
`provider · channel · name · isPrimary · isActive · credentials(Json, **unencrypted, unread**) · settings?`

### 4.8 Enums (exact values — use verbatim)
- `CommunicationChannel`: EMAIL · SMS · WHATSAPP · PUSH · IN_APP
- `NotificationCategory`: AUTHENTICATION · ACADEMIC · ADMISSIONS · FEES · ANNOUNCEMENT · SYSTEM
- `NotificationPriority`: LOW · NORMAL · HIGH · URGENT
- `NotificationStatus`: UNREAD · READ · ARCHIVED
- `OtpPurpose`: LOGIN · PASSWORD_RESET · EMAIL_VERIFY · PHONE_VERIFY · MFA · PAYMENT · ADMISSION
- `DeliveryStatus`: PENDING · QUEUED · SENT · DELIVERED · OPENED · CLICKED · FAILED · BOUNCED · RETRIED
- `TemplateStatus`: DRAFT · PUBLISHED · ARCHIVED
- `ProviderType`: SMTP · AWS_SES · RESEND · MAILGUN · POSTMARK · TWILIO · MSG91 · META_WHATSAPP · FIREBASE_FCM · CUSTOM

---

## Part 5 — Workflow Analysis

### W1 — Template authoring
`Create (DRAFT)` → edit body/variables → **Preview** (`POST /preview`, resolves `missingVariables`) → `PATCH status=PUBLISHED` → superseded by creating a **new row with version+1** → `PATCH status=ARCHIVED`.
*UI truth:* "Publish" and "Archive" are status patches, not endpoints. "New version" is a **create** with the same `code` and a higher `version` — the editor must offer it as an explicit action or users will silently overwrite a live template.

### W2 — OTP (machine flow; no admin UI)
`generate` → dispatch via subscriber → `verify` → success marks used + revokes siblings. Failure increments `attempts`; at `maxAttempts=5` the token is revoked. Resend is blocked until `resendAvailableAt` (60 s default). **Only the auth screens touch this** — the Communication module renders no OTP UI.

### W3 — Delivery lifecycle (observed, never driven)
Subscriber dispatches → `logDelivery` writes `PENDING/SENT/…` → `updateStatus` can advance to `DELIVERED/OPENED/CLICKED/FAILED`. **No webhook receiver exists**, so `openedAt`/`clickedAt` will be null in practice — design the columns to degrade to "—" rather than implying tracking works.

### W4 — Settings
Read (defaults if unset) → toggle → `PATCH` with **only changed fields** → applies at the next dispatch. No test, no rollback, no history.

### W5 — Notification inbox
List (pinned first) → open (`actionUrl` deep-link) → read / archive / read-all. Creation is admin-initiated, one `userId` at a time.

### W6 — Preferences
Read all six categories → toggle a channel → `PATCH {category, …}` → applies to future dispatches, **except `AUTHENTICATION`**.

---

## Part 6 — UX Recommendations

### Navigation
Add **one** top-level Administration item, `Communication` (icon `MessageSquare` or `Send`), between *Audit Logs* and *System Settings*, with children: Overview · Templates · Delivery Logs · Analytics · Settings.
Put the **user-facing** surfaces elsewhere, because they are not admin screens: the **bell** in the top nav, `/app/notifications` (inbox) and `/app/notifications/preferences` reached from the user menu.

### Information architecture principles
1. **Admin vs personal split** — Communication (admin) and Notifications (personal) are different mental models; do not nest one under the other.
2. **Scope is ambient** — org/branch come from the workspace switcher, not from in-page pickers; delivery-log and settings screens must state the active scope in a caption.
3. **Reuse the Audit Explorer pattern** for Delivery Logs — it already solves toolbar + filters + server pagination + detail drawer.
4. **Reuse the Academic Unit form pattern** for the template editor — `Form` + `TextField`/`SelectField`/`TextareaField`, card-grouped sections.
5. **Every disabled control states why** with `BackendPendingNote` — never a dead button.

### Tables, filters, actions
- Filters as `SelectField`s bound to the real enums; search debounced 200 ms (matching `useDebouncedValue` elsewhere).
- Row actions via `DropdownMenu`; destructive/consequential actions via `ConfirmDialog`.
- All list filtering is **server-side** for delivery logs (documented params) and **server-side** for templates (`channel`, `status`, `search`).

---

## Part 7 — Template Builder Analysis

One editor, **channel-aware field visibility** — the backend stores all body fields for all channels, so the UI must guide rather than the schema.

| Channel | Subject | bodyHtml | bodyText | Preview surface |
| :-- | :-- | :-- | :-- | :-- |
| EMAIL | ✅ required-in-practice | ✅ primary | ✅ fallback | Desktop email frame |
| SMS | ✖ hide | ✖ hide | ✅ only | 160-char counter, plain bubble |
| WHATSAPP | ✖ hide | ✖ hide | ✅ only | Chat bubble |
| PUSH | ✅ = title | ✖ hide | ✅ = body | Device notification card |
| IN_APP | ✅ = title | optional | ✅ = content | Inbox row preview |

**Editor sections:** Identity (`code`, `name`, `description`, `language`, `version`) · Classification (`channel`, `category`) · Scope (org/branch — explain the three-level fallback) · Content (channel-aware) · Variables (chips; auto-extracted server-side if omitted) · Status.

**Preview panel:** variables key/value form → `POST /preview` → rendered `subject`/`bodyHtml`/`bodyText` + a warning listing `missingVariables`. This is the single most valuable screen in the module and it is **fully backed**.

**Versioning UI:** show `version` prominently and offer "Save as new version" (create with version+1). There is no history endpoint — list the sibling versions from the directory list filtered by `code`.

---

## Part 8 — Communication Settings

Two cards, one screen, exactly the 12 writable fields:

**Channels** — five toggles (`emailEnabled`, `smsEnabled`, `whatsappEnabled`, `pushEnabled`, `otpEnabled`). Caption: SMS/WhatsApp/Push providers are **stubs today**, so enabling them changes routing, not reachability.
**Operations** — `trackingEnabled`, `analyticsEnabled`, `retryEnabled`.
**Default providers** — four `ProviderType` selects. Caption must state that only `SMTP` has a real implementation; the rest select a provider that is not yet built.

Not present anywhere in the API, therefore not on the screen: credentials, sender identity, signature, branding, business hours, rate limits, retry counts/backoff values.

---

## Part 9 — Analytics

**What the endpoint gives (all of it):** `{ total, sent, delivered, failed, bounced, metrics: { deliveryRate, failureRate, bounceRate } }`, filtered only by `organizationId` / `branchId`.

**Design accordingly:**
- **6 KPI cards** (`StatCard`): Total · Sent · Delivered · Failed · Bounced · Delivery Rate.
- **2 rate gauges**: Failure Rate, Bounce Rate (`Progress`).
- **1 composition bar**: Sent/Delivered/Failed/Bounced as proportions of `total`.

**Explicitly not designable from the API:** time series (daily/monthly), per-channel breakdown, per-provider breakdown, latency distribution, open/click funnels, cost. Derive nothing from a single page of `/delivery-logs` — that would present one page as a total. Mark each with `BackendPendingNote`.

---

## Part 10 — Role Analysis

| Screen | SUPER_ADMIN | ORG_ADMIN | BRANCH_ADMIN | STAFF | STUDENT | PARENT |
| :-- | :--: | :--: | :--: | :--: | :--: | :--: |
| Overview / Analytics / Delivery Logs | ✅ | ✅ | ✅ | ✖ | ✖ | ✖ |
| Templates — view | ✅ | ✅ | ✅ | ✖ | ✖ | ✖ |
| Templates — create/edit | ✅ | ✅ | ✖ read-only | ✖ | ✖ | ✖ |
| Settings — view | ✅ | ✅ | ✅ | ✖ | ✖ | ✖ |
| Settings — edit | ✅ | ✅ | ✖ | ✖ | ✖ | ✖ |
| Send notification (single user) | ✅ | ✅ | ✅* | ✖ | ✖ | ✖ |
| Inbox + bell | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Preferences | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

\* `POST /notifications` carries **only `JwtAuthGuard`** — any authenticated user can currently create a notification for any `userId`. Treat the admin-only placement as a UI decision, and flag it: this is an authorization gap worth raising with the backend.

---

## Part 11 — Scalability Review

Design so these drop in without redesign:
1. **Channel-agnostic components** — `ChannelBadge`, `ChannelIcon`, channel-aware preview driven by a map, so Slack/Teams/Voice/Webhook become map entries.
2. **Status-agnostic chips** — `DeliveryStatusBadge` keyed off the enum with a neutral fallback for unknown values.
3. **Composable filter bar** — filters declared as data so a new one is a config line.
4. **Left the door open** for a future compose/broadcast flow by keeping Templates ➝ Preview ➝ (future) Send as a visible but disabled path.
5. **Analytics widgets take a data shape, not an endpoint**, so a future time-series endpoint fills existing charts.

---

## Part 12 — Stitch UI Generation Specification

### Design language (inherit exactly — do not invent)
Soft Enterprise: `Card`-grouped sections with `border-b` headers · shadcn/Radix primitives · semantic tokens only (`bg-primary`, `text-muted-foreground`, `var(--elevation-md)`) · Tailwind v4 · mobile-first 320→1920 · sidebar + top-nav app shell · `DataTable` + toolbar + pagination for every list · `DetailDrawer` for record detail · `ConfirmDialog` for consequence · `StatCard` for KPIs · `StatusBadge` for enums · `EmptyState`/`LoadingState`/`ApiErrorState` for the three non-happy states.

### Shared components to reuse (already exist)
`DataTable` · `DataTableToolbar` · `DataTablePagination` · `DataTableColumnHeader` · `StatCard` · `StatusBadge` · `DescriptionList` · `DetailDrawer` · `ConfirmDialog` · `EmptyState` · `LoadingState` · `ApiErrorState` · `ForbiddenState` · `Banner` · `BackendPendingNote` · `Skeletons` · `Form`/`TextField`/`SelectField`/`SwitchField`/`TextareaField` · `Tabs` · `Sheet` · `DropdownMenu` · `Progress` · `Badge` · `Avatar`.

### New components this module needs (5)
1. `ChannelBadge` — icon + label per `CommunicationChannel`
2. `DeliveryStatusBadge` — 9 states, tone-mapped (SENT/DELIVERED success · FAILED/BOUNCED destructive · PENDING/QUEUED/RETRIED neutral · OPENED/CLICKED info)
3. `TemplateStatusBadge` — DRAFT neutral · PUBLISHED success · ARCHIVED muted
4. `VariableChips` — renders `string[] | Record<string,unknown>`, click-to-insert
5. `ChannelPreviewFrame` — email / SMS / WhatsApp / push / in-app skins

### Screens to design, in this exact order (12 + 6 overlays)

**Phase 1 — the spine (design first)**
1. **Communication Overview** — page header + scope caption; 6 `StatCard` KPIs; 2 rate gauges; "Channels enabled" summary from settings; "Recent deliveries" 5-row mini table linking to the explorer; `BackendPendingNote` where time-series would go.
2. **Templates Directory** — toolbar (search + `channel` select + `status` select) · `DataTable` columns: Name · Code · `ChannelBadge` · Category · Language · Version · Scope (Global/Org/Branch) · `TemplateStatusBadge` · Updated · row menu (View / Edit / Preview / Publish / Archive) · empty + loading + error states.
3. **Template Detail** — two columns: left `DescriptionList` (all metadata + scope explanation), right rendered body with `ChannelPreviewFrame`; `VariableChips`; version strip listing sibling versions; actions: Edit · Preview · Publish/Archive.
4. **Template Create** — cards: Identity · Classification · Scope · Content (channel-aware) · Variables · Status; sticky footer Cancel/Create; inline preview button.
5. **Template Edit** — identical to 4, pre-filled, plus "Save as new version" and an unsaved-changes guard.
6. **Template Preview drawer** — variables form (left) → rendered output (right) in the channel frame → amber `Banner` listing `missingVariables`.

**Phase 2 — operations**
7. **Delivery Logs Explorer** — toolbar: recipient search · channel · status · provider · date range; `DataTable` columns: Created · Recipient · `ChannelBadge` · Provider · Subject · `DeliveryStatusBadge` · Latency · Retries · row → drawer; server pagination.
8. **Delivery Log detail drawer** — `DescriptionList` of the loaded row: identifiers, template + version, timing (sent/delivered/opened/clicked), error code + message in a destructive `Banner` when failed, raw `metadata` JSON block.
9. **Delivery Analytics** — the 6 KPIs + 2 gauges + composition bar, with three `BackendPendingNote` placeholders (per-channel, per-provider, over-time).
10. **Communication Settings** — Channels card (5 switches) · Operations card (3 switches) · Default Providers card (4 selects) · scope caption · save bar · disable-channel confirm.

**Phase 3 — the personal surface**
11. **Notification Inbox** — left filter rail (status/category/priority/pinned) · list with pinned section, priority accent, unread dot, category chip, relative time, action link · "Mark all read" · pagination · empty state.
12. **Notification Bell + Panel** — `Popover` from the top nav: unread count badge (from `meta.unreadCount`), 5 most recent, mark-read on click, "View all".
13. **Notification Preferences** — 6 category rows × 5 channel switches in a matrix; `AUTHENTICATION` row shown **locked with an explanatory `Banner`** (security override).
14. **Send Notification (single user)** — user id, title, content, category, priority, action URL, pin toggle, metadata JSON; explicitly captioned as one recipient, because the API takes one `userId`.

**Overlays across the set:** Preview drawer · Publish/Archive confirm · Delivery detail drawer · Mark-all-read confirm · Disable-channel confirm · Unsaved-changes guard.

### Screen count
**14 screens · 6 overlays · 5 new components.** Every one is backed by one of the 18 live endpoints.

---

## 13. Future Enhancements

**Not in the backend. Do not design as functional UI.** If shown at all, show disabled with `BackendPendingNote`.

| Capability | What is missing |
| :-- | :-- |
| Broadcast / campaigns / compose | No send endpoint exists at all |
| Scheduling, queues, cron | No endpoint; `retry/` has no controller |
| Audience / recipient builder | No recipient-list endpoint |
| Provider management + credentials | `ProviderConfig` has no controller; `credentials` is unencrypted |
| Template delete / duplicate / history / test-send | No endpoints |
| Delivery retry / resend / export / webhooks | No endpoints; `openedAt`/`clickedAt` will stay null |
| Time-series, per-channel, per-provider analytics | Analytics returns 6 totals + 3 rates only |
| Bulk notification actions, unpin, delete | No endpoints |
| OTP admin console | No read API by design (hash-only storage) |
| Slack / Teams / Voice / Webhook / AI / A-B / approvals | Not in `CommunicationChannel` |

### Backend issues worth raising (found during analysis, not fixed)
1. `POST /communication/notifications` has **no `@Roles()`** — any authenticated user can create a notification for any `userId`.
2. `ProviderConfig.credentials` is plaintext `Json`; the schema comment says encrypt before first write.
3. Three subscriber handlers (`user.logged_in`, `applicant.created`, `admission.transitioned`) are **debug-log stubs** — those categories will have no traffic.
4. Delivery-log and settings endpoints take `organizationId`/`branchId` as **query parameters** rather than reading the resolved execution context, so scoping is caller-supplied.
