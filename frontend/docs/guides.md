# Guide / Walkthrough System

An in-app, page-aware guidance platform: a page explains what it does, an
action's success explains what to do next, and a small spotlight walkthrough
(built on `react-joyride`, fully restyled) can walk a user through a real,
already-shipped flow — never an invented one. Ships once, as reusable
infrastructure in `core/guides`; a page gets a guide by a feature module
authoring one `GuideDefinition` and the app layer registering it.

Three guides ship today, covering the start of the core setup journey
(`Organization → Branch → Academic Year → …`, per `docs/administration-modules.md`):

| Guide           | File                                                          | Pattern it demonstrates                                         |
| ---------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `organizations`  | `src/features/organization/guide/organizations.guide.ts`       | Create → an explanatory last step (no real "activate" exists)     |
| `branches`       | `src/features/branch/guide/branches.guide.ts`                  | Create → cross-route "action" step → explanatory last step        |
| `academic-years` | `src/features/academic-year/guide/academic-years.guide.ts`     | Create → cross-route "action" steps all the way through Activate  |

`academic-years` is the fullest worked example (every step is `advanceOn:
"action"`, including the final one) and is referenced throughout this
document; `organizations` and `branches` are the reference for the
**explanatory last step** pattern — see §12.

---

## 1. Architecture

```
core/guides/            platform infrastructure — zero business logic
  types.ts              GuideDefinition, GuideStep, GuideCondition, …
  route-match.ts         matchesRoute / stepsForRoute / extractRouteParam
  registry.ts             registerGuide / getGuide / getGuidesForRoute
  guide-store.ts          Zustand store: run state + persisted completion
  target-readiness         (not a separate module — see §3, Joyride handles this)
  guide-tooltip.tsx       the custom CampusFlow tooltip card
  guide-provider.tsx      mounts one <Joyride>, drives it from the store
  use-guide.ts            the public hook feature code calls
  help-drawer.tsx         the "?" entry point (Sheet-based)
  index.ts                public barrel

features/<name>/guide/    guide *content* — feature-owned, not core
  <name>.guide.ts          one GuideDefinition per guide

src/app/(app)/
  guide-registrations.ts   registers every shipped guide, once
  layout.tsx                mounts <GuideProvider> inside <RequireWorkspace>
```

Three rules keep "add a guide" cheap:

- **`core` never imports a feature.** A guide's *content* (steps, copy,
  targets) lives in the feature that owns the screens it describes; `core`
  only knows the generic `GuideDefinition` shape.
- **Registration happens once, at the app layer.** `guide-registrations.ts`
  imports each guide's definition and calls `registerGuide()` — the same
  place cross-feature composition already happens for this route group
  (`AGENTS.md` §28's "two features meet at the route" rule). Adding a guide
  is one more import + one more call there.
- **A screen never touches Joyride.** It calls `useGuide(id)` and gets back
  `startGuide` / `reportEvent` / `completeGuide` / `isAvailable` / `hasSeen` —
  nothing else. `GuideProvider` is the only thing that renders `<Joyride>`.

---

## 2. Installation

```bash
pnpm add react-joyride
```

`react-joyride@3.x` declares `peerDependencies: { react: "16.8 - 19" }` —
React 19 is covered, no `pnpm.overrides` needed. It ships its own types; do
not add `@types/react-joyride`.

Note: this is the **3.x** API (`Joyride`, `onEvent`, controlled `run`/
`stepIndex`), a rewrite from the older 2.x `callback`/`disableBeacon`/
`spotlightClicks` API many older examples online still show. Read
`node_modules/react-joyride/dist/index.d.mts` before changing
`guide-provider.tsx` or `guide-tooltip.tsx` — the props/events differ from
what you may remember.

---

## 3. Provider

`GuideProvider` mounts exactly once, inside `src/app/(app)/layout.tsx`,
**inside** `<RequireWorkspace>`:

```tsx
<ProtectedRoute>
  <RequireWorkspace>
    <GuideProvider>
      <AppLayout>{children}</AppLayout>
      <CommandPalette />
    </GuideProvider>
  </RequireWorkspace>
</ProtectedRoute>
```

That placement is the whole gating story: a guide can never even attempt to
find a target before the active workspace — and therefore the page's data —
is ready. It never mounts for `(auth)` or `(public)` routes.

Each render it computes **at most one** Joyride step: the guide's current
logical step, only if that step's route matches `usePathname()`. Joyride's
own `targetWaitTimeout` (set generously via the `options` prop) makes it wait
for the target to appear and scroll to it — there is no separate
hand-rolled "target readiness" polling utility in `core/guides`; building one
would have duplicated what the library already does correctly (see
`docs/guides.md` §13 for what was deliberately *not* built).

`disableBeacon`/`spotlightClicks` from the 2.x API do not exist in 3.x — the
equivalents are `skipBeacon` (set globally, so every step's tooltip shows
immediately rather than behind a beacon click) and
`blockTargetInteraction: false` (the default — pointer events pass through
the spotlight cutout, so the highlighted control stays clickable).

---

## 4. Registry

```ts
// src/app/(app)/guide-registrations.ts
"use client";

import { registerGuide } from "@/core/guides";
import { academicYearsGuide } from "@/features/academic-year";

registerGuide(academicYearsGuide);

export function GuideRegistrations() {
  return null;
}
```

```tsx
// src/app/(app)/layout.tsx
<GuideProvider>
  <GuideRegistrations />
  {children}
</GuideProvider>
```

`registerGuide` is safe to call more than once for the same id (a duplicate
is logged in development and ignored — never thrown) so a Fast Refresh
re-evaluation of this module can never crash the app it exists to help
explain.

**This module must be `"use client"` and rendered as JSX — never a bare
`import "./guide-registrations"`.** `layout.tsx` is a Server Component, and
Next's RSC/client split gives the server bundle and the browser bundle their
own separate module instance of `core/guides`' registry `Map`. A bare
side-effect import from a Server Component only ever reaches the *server's*
copy — the one used while producing the initial HTML — never the browser's.
`useGuide()`/`GuideHelpTrigger` run client-side after hydration and read the
*client's* copy, which would stay permanently empty, so every guide would
silently report itself unavailable forever with no error anywhere. Rendering
`<GuideRegistrations />` forces Next to ship this chunk to, and execute it
in, the browser as well. The registration call still runs exactly once, at
module evaluation, regardless of how many times the (no-op) component itself
re-renders.

---

## 5. Creating a page guide

Write one `GuideDefinition` per guide, in the owning feature, under
`features/<name>/guide/<name>.guide.ts`:

```ts
export const academicYearsGuide: GuideDefinition = {
  id: "academic-years",
  version: 1,
  title: "Academic Years",
  description: "Create an academic year, then activate it.",
  entryRoutes: [ROUTES.app.academicYears.root],
  steps: [
    {
      id: "create-link",
      route: ROUTES.app.academicYears.root,
      target: '[data-guide="academic-year-dashboard-create-link"]',
      title: "Create your first academic year",
      description: "…",
      advanceOn: "action",
    },
    // …
  ],
};
```

Export it from the feature's `index.ts` and add the one registration line in
`guide-registrations.ts`. Nothing else in `core/guides` changes.

**Before writing a step, verify the button/route/action it targets actually
exists** (in the real UI and in the documented backend contract) — the whole
point of this system is to never gesture at functionality that isn't there.
The Academic Years guide, for instance, never references Deactivate,
Deselect, Unlock, Archive, Restore or Permanent-delete — none of them exist
in the documented contract (`docs/academic-year-module.md`), and the UI
already marks them `BackendPendingBadge`.

### When *not* to build a guide

A guide is not owed to every page. Before authoring one, check:

- **Does the module's `docs/*-module.md` describe a real, multi-step
  workflow** (a create-then-configure flow, a lifecycle with a genuine
  transition, a cross-route journey)? A single form with nothing to explain
  beyond its own field labels does not need a walkthrough — the form is
  already the whole workflow.
- **Is there a real business-meaning explanation to give**, beyond "click
  here"? If the only thing a step could say is the button's own visible
  label, it isn't adding anything. §5's copy standard (business meaning, not
  button location) is the bar; a step that can't clear it shouldn't exist.
- **Does the page's real state already communicate what's needed?** An
  `EmptyState` with a "Create the first X" action (every dashboard in this
  codebase already has one) *is* the contextual hint — a guide is for
  teaching the multi-step workflow behind that button, not for restating
  that the button exists.

This is why, of the ~20 shipped feature modules, only three have a guide so
far: Organizations, Branches and Academic Years form one connected,
real setup journey (§1's table) with genuine cross-route steps and
non-obvious business rules (soft delete, a non-idempotent toggle, a one-way
activation) worth explaining. A module with no comparable workflow — a flat
settings page, a single-endpoint CRUD screen with no lifecycle — is not
missing a guide; it never needed one. Extending the journey (Academic Units,
Programs, Admissions, …) is the natural next step, each following this same
checklist rather than being added wholesale.

---

## 6. Adding `data-guide` targets

`data-guide="<kebab-case-id>"` is the one stable-selector convention this
feature introduces — nothing before it in the codebase used `data-testid` or
similar. `Button` and every other primitive already spread arbitrary props,
so it's a plain attribute:

```tsx
<Button data-guide="academic-year-create-submit">Create academic year</Button>
```

Then the step references it: `target: '[data-guide="academic-year-create-submit"]'`.

Only annotate real, meaningful interaction points — not every element. A
shared component that renders more than one action at once (e.g. the
lifecycle screen's `ActionRow`, shared by Activate/Select/Lock) takes the
`data-guide` value as a prop from its caller, applied conditionally to only
the one action a guide actually targets.

---

## 7. Triggering a guide step after a mutation

Two ways a step ends, chosen per step via `advanceOn` (which only controls
whether the tooltip shows a "Next" button — it never changes *how* Joyride
finds the step, only what the card offers the user):

- **Route auto-catch-up** (no code in the mutation path at all): once the
  user is on a page whose upcoming step's route matches, `GuideProvider`
  advances the stored step index to it automatically. This is how "click the
  real Create link" and "click the real Lifecycle link" work — there is no
  synthetic Next button standing in for a real link (`AGENTS.md`-style rule:
  don't require Next when the real control is the next action).
- **Explicit `reportEvent()` / `completeGuide()`**, called from the screen,
  strictly *after* the screen's own existing success handling:

  ```ts
  const created = await create.mutateAsync(toAcademicYearRequest(values));
  router.push(/* … the existing redirect, unchanged … */);
  if (created?.id) guide.reportEvent({ entityId: created.id });
  ```

  Never inside the shared mutation hook's `onSuccess` (that stays owned by
  toast/cache-invalidation concerns only) — always as one additional line in
  the screen, after the real behavior. This is what keeps the guide strictly
  additive: delete the guide call and the screen behaves exactly as it did
  before this feature existed.

`reportEvent({ entityId })` matters whenever the *next* step's route carries
a dynamic segment (`:id`) — see §8.

### Type A vs Type B steps — and when to use `"next-button"`

Every step is one of two kinds, and `advanceOn` is how a step declares which:

- **Type A — action.** The next thing the user needs to do is click a real,
  already-shipped control (`advanceOn: "action"`). No Next button; the
  tooltip says "Complete this step in the app to continue." This is the
  default, and every Academic Years step uses it.
- **Type B — explanatory.** The user only needs to understand something —
  there is no further real action to demonstrate, or the real action exists
  but has a genuine consequence a first-time walkthrough should not perform
  on the user's behalf (`advanceOn: "next-button"`). The tooltip shows Next,
  and clicking it calls `reportEvent()`/`completeGuide()` automatically —
  **no screen-side wiring is needed for a Type B step at all**, only its
  `data-guide` target.

Both `organizations` and `branches` end on a Type B step, and for the same
reason: neither has a safe, idempotent "next action" to demonstrate.
Deactivating an organization is a soft delete with no reverse; flipping a
branch's status toggle sets no target state, so firing it programmatically on
the user's behalf — even at their request — is exactly the "guide lied about
completing something the user didn't actually do" failure mode this platform
exists to avoid. A guide never simulates a consequential action just to give
itself a Next button to skip past it. When a real workflow's last reachable
point is "here's what this screen can do, nothing needs changing right now,"
end there, honestly, on a Type B step — don't invent one more action to make
the guide feel longer.

---

## 8. Cross-route workflows and the entity-scoping rule

A guide is not required to live on one page. `GuideStep.route` names the
route each step belongs to, and `GuideProvider` only ever shows the step
whose route matches where the user currently is — there is no separate
"workflow" concept layered on top; a multi-route guide is just a
`GuideDefinition` whose steps happen to declare different routes.

**The hazard this closes:** if step *N+1*'s route contains `:id` (e.g.
`/app/academic-years/:id`), matching the route pattern alone is not enough —
any existing record's page would satisfy it, and a user who wanders to an
*unrelated* record mid-guide must never be mistaken for having completed the
guide's own action. `guide-store`'s `entityId` field exists for exactly this:
once a step captures the real record's id (via `reportEvent({ entityId })`),
every later step whose route has a dynamic segment matches *only* that id —
never merely "some id." A step with no dynamic segment (like `/new`) needs no
entity and matches unconditionally.

This is the one piece of genuinely non-obvious logic in `guide-provider.tsx`
— read its `stepMatchesPathname` function before changing the matching
behavior.

---

## 9. Role-aware guides

`GuideStep`/`GuideDefinition.requirement` is a `GuideCondition`:

```ts
type GuideCondition = (context: {
  permissions: PermissionContextValue;
  workspace: WorkspaceContextValue;
}) => boolean;
```

Evaluated against the real, generic `usePermissions()`/`useWorkspace()`
context. **CampusFlow has no fixed role-name enum** — only flat permission
strings and `hasRole(role: string)` — so a `requirement` must never hardcode
a role name like `"Owner"` or `"Principal"`; those do not exist anywhere in
the codebase. The Academic Years guide ships with no `requirement` at all: it
gates on nothing beyond ordinary page access, because nothing more specific
is documented.

---

## 10. Persistence

`core/guides/guide-store.ts` is a Zustand store with `persist`, mirroring
`src/store/preferences-store.ts` exactly: only completion records
(`{ [guideId]: { version, completedAt } }`) survive a reload, under
`STORAGE_KEYS.guideProgress`. Which guide is currently running, at which
step, and for which captured entity id, is transient — a hard refresh always
resets to idle, the same way a Joyride tour itself never resumes across one.

---

## 11. Versioning

Bump `GuideDefinition.version` when the steps or copy change meaningfully.
`useGuide(id).hasSeen` compares the shipped `version` against the stored
completion record's `version` — a bump makes a previously-completed guide
eligible to run again, without deleting or migrating the old record, and
without forcing a user through an *unchanged* tour repeatedly.

---

## 12. Accessibility

Comes largely from Joyride 3.x itself (focus trap, `Escape` handling via
`dismissKeyAction`, `role="alertdialog"`/`aria-modal` on the tooltip) plus the
platform `Button` (focus rings, keyboard operability) used throughout
`guide-tooltip.tsx`. Two things this feature adds on top:

- A visible focus ring on the **real target element**, not just Joyride's
  dimmed-overlay cutout — `GuideProvider` toggles a small set of ring
  utility classes on the actual DOM node while its step is active (see the
  effect in `guide-provider.tsx`), cleaned up on unmount/step change.
- `--overlay-scrim` (in `styles/design-tokens.css`, with a `SurfaceTokens`
  entry in `core/theme/types.ts`) rather than Joyride's default translucent
  black, so the dim respects the existing token system and both themes.

`prefers-reduced-motion` is not separately toggled: this feature adds no
animation beyond Joyride's own tooltip transition and a non-animated class
toggle for the ring, so there is nothing extra to disable.

**Every `*Props` Joyride spreads onto a button carries its own
`aria-label`/`title`, and it is not always what the visible text says.**
`skipProps.aria-label` is `"Skip"` (our button reads "Skip guide"), and —
easy to miss, since it depends on step *position* rather than the step
itself — `primaryProps.aria-label` is `"Next"` on every step **except the
guide's last one, where Joyride sets it to `"Last"`**. An explicit
`aria-label` always wins over visible text for the accessible name, so
without an override a screen reader announces "Last" on a button that
visibly says "Next." `guide-tooltip.tsx` sets `aria-label="Next"` (and
`aria-label="Skip guide"`) explicitly, after spreading, for exactly this
reason — any new button added to the tooltip that spreads a Joyride
`*Props` needs the same treatment if its visible text is static.

---

## 13. Testing

- **Unit** (`tests/unit/guide-route-match.test.ts`,
  `guide-registry.test.ts`, `guide-store.test.ts`): the pure pieces —
  route/param matching, registry lookup and duplicate handling, store
  transitions and the persistence round-trip (only `completed` survives).
- **Integration** — one spec file per guide, mounting the real screens under
  `<GuideProvider>` with the existing `render` helper from
  `@tests/setup/render` (no separate `renderWithGuides` export exists; each
  file wraps its own tree):
  - `tests/integration/academic-years-guide.test.tsx` — the fullest example:
    no tooltip when nothing is running; no tooltip when the running step's
    route doesn't match the page; automatic route catch-up; a real mutation
    success capturing the entity id and advancing; **the entity-scoping
    regression itself** (§8); a real activation completing the guide; skip;
    and — since this is also where the Help trigger itself is exercised —
    that the drawer fully closes (not merely gets covered by) before the
    tour starts (§3).
  - `tests/integration/organizations-guide.test.tsx`,
    `tests/integration/branches-guide.test.tsx` — the Type B / explanatory
    last-step pattern (§7): completing the guide via the tooltip's own Next
    button, with **no mutation involved at all** for that step.
  - Every spec calls `registerGuide()` itself (via
    `__resetGuideRegistryForTests()` + `registerGuide(<theGuide>)` in
    `beforeEach`) — registration is normally a side effect of rendering the
    app layer's `<GuideRegistrations />` (§4), which these specs never mount.
- **E2E** (`tests/e2e/academic-year-guide.spec.ts` +
  `tests/e2e/fixtures/auth.ts`): see `tests/e2e/README.md` for the
  `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` it needs and the known cost of running
  it repeatedly (a real, irreversible activation against a real backend).

**Deliberately not built this pass:** a bespoke `target-readiness.ts`
polling/`MutationObserver` utility. Joyride 3.x's own `targetWaitTimeout` +
scroll-into-view already does this correctly; adding a second implementation
would have been the exact kind of duplicated-library-logic `AGENTS.md` §14
warns against.

---

## 14. Troubleshooting

- **Tooltip never appears on a page that should have one.** Check the
  step's `route` pattern against the actual pathname (`route-match.ts`'s
  `matchesRoute` — one dynamic segment per path component, written `:name`).
  If the route has `:id`, confirm an earlier step actually captured the
  entity id via `reportEvent({ entityId })` — see §8; without it, an
  id-scoped step never matches, by design.
- **Guide replays after the user already "finished" it.** Check
  `GuideDefinition.version` against what's stored in `localStorage` under
  `STORAGE_KEYS.guideProgress` — a version bump is expected to reopen it
  (§11); if that's not what happened, something else cleared `completed`.
- **Guide doesn't start on a fresh page load / a totally new guide never
  shows up anywhere.** Confirm its `registerGuide()` call is actually reached
  — the registration line lives only in `src/app/(app)/guide-registrations.ts`;
  a guide whose module is never imported from there is never registered, and
  `getGuide()`/`useGuide()` will just report it unavailable, silently.
- **The Help (`?`) trigger never appears on any page, for any guide, even
  though the definition, the `data-guide` targets and everything else look
  right.** This is the registry client/server split, not a per-guide bug —
  see §4. Confirm `guide-registrations.ts` still has `"use client"` at the
  top and is rendered as `<GuideRegistrations />` inside `layout.tsx`, not
  bare-imported. Verifying it: check the route's
  `.next/**/page_client-reference-manifest.js` (dev) actually lists
  `guide-registrations` — if it's missing, the registration chunk never
  reaches the browser and every guide reports `isAvailable: false` with no
  console error, because nothing actually threw.
- **Target genuinely isn't in the DOM.** Joyride's own `TARGET_NOT_FOUND`
  event fires after `targetWaitTimeout`; `GuideProvider`'s `onEvent` handler
  logs a `console.warn` in development (never in production, never a
  user-facing error) and ends the guide gracefully via `stop("skipped")`.
