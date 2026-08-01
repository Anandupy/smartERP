# Authentication Screens

The auth feature (`src/features/auth`) owns every screen a visitor sees before
they have a session. This page documents what ships today, how it is composed,
and where the not-yet-built pieces plug in.

> **Status.** Login, refresh, logout, session management and password recovery
> are **wired to the backend**. The OTP screens are built and their endpoints
> are wired, but they are **not part of password recovery** — see
> [Password recovery](#password-recovery-flow).

## Routes

| Route               | Screen component        | Purpose                                                        |
| ------------------- | ----------------------- | -------------------------------------------------------------- |
| `/splash`           | `SplashScreen`          | Brand entry + boot sequence; asks the startup flow where to go |
| `/welcome`          | `WelcomeScreen`         | First-run brand introduction + single CTA into login           |
| `/login`            | `LoginScreen`           | Credential entry                                               |
| `/forgot-password`  | `ForgotPasswordScreen`  | Recovery step 1 — request a reset email                        |
| `/email-sent`       | `EmailSentScreen`       | Recovery step 2 — confirmation and resend                      |
| `/verify-otp`       | `OtpVerificationScreen` | **Not in the recovery path** — reserved for LOGIN/MFA/verify   |
| `/reset-password`   | `ResetPasswordScreen`   | Recovery step 3 — reached from the emailed link (`?token=`)    |
| `/password-success` | `PasswordSuccessScreen` | Recovery outcome                                               |
| `/account-locked`   | `AccountLockedScreen`   | Session state — too many failed attempts                       |
| `/session-expired`  | `SessionExpiredScreen`  | Session state — ended through inactivity                       |

Every page lives under `app/(auth)/<segment>/page.tsx`. Paths are declared once
in `constants/routes.ts` (`ROUTES.auth.*`) — never spelled inline. Pages are
thin server components that set `metadata` and render one feature component; all
interactivity lives in the feature.

## Startup flow

Where the application goes after splash is **one decision in one place**:
`core/startup`. Page components never make it.

```
launch → /splash → resolveStartupRoute(context)
                     ├── valid session      → /app        (future)
                     ├── onboarding pending → /welcome → /login
                     └── otherwise          → /login
```

| Piece                 | Responsibility                                                     |
| --------------------- | ------------------------------------------------------------------ |
| `resolveStartupRoute` | Pure, total policy function — the whole decision, trivially tested |
| `OnboardingStorage`   | Swappable storage seam (Web Storage by default, memory in tests)   |
| `useStartupRoute`     | Reads the flag via `useSyncExternalStore`, returns the destination |
| `WelcomeCta`          | Marks onboarding complete as it hands off to login                 |

The flag is stored under **`campusflow.onboarding.completed`** (declared in
`constants/storage-keys.ts`). It is deliberately spelled with dots rather than
the `campusflow:` namespace the other keys use, because the startup contract
fixes that exact key.

Two properties matter and are covered by tests:

- **Onboarding is independent of authentication.** A returning visitor whose
  session expired still skips welcome; a session is never allowed to resurrect
  the first-run experience.
- **Storage failure is not fatal.** If Web Storage throws (private mode, policy)
  the flag reads as "not completed" — the visitor sees welcome again, which is
  a degraded experience rather than a crash.

This onboarding check is **temporary**. When backend session validation lands,
`useStartupRoute` awaits it and passes the result into `resolveStartupRoute`'s
existing `session` parameter; the flag stays, and nothing that consumes the hook
changes.

### Route group and guarding

`app/(auth)/layout.tsx` wraps the group in `GuestRoute` only. It deliberately
does **not** impose a shell, because auth screens legitimately differ: splash is
full-bleed while every other screen is two-column. Each screen picks its own
shell.

## Layout composition

```
(auth)/layout.tsx → GuestRoute
  └── SplashScreen        → AuthBrandPanel                       (full-bleed)
  └── WelcomeScreen       → AuthSplitLayout + WelcomeBrandPanel
  └── LoginScreen         → AuthSplitLayout + LoginBrandPanel
  └── form screens        → AuthSplitLayout + AuthMessagePanel   (Card + form)
  └── outcome screens     → AuthStatusScreen + AuthMessagePanel
```

- **`AuthSplitLayout`** (`components/layouts`) is generic structure: a brand
  panel beside a centered content column, with a `footer` slot. It contains no
  brand content — the feature injects every pixel of it. See
  [Layouts](./layouts.md).
- **`AuthBrandPanel`** (feature) is the decorative canvas shared by all brand
  moments: brand canvas, a token-tinted dot grid, and two blurred ambient orbs.
  Every layer is `aria-hidden` and `pointer-events-none`.
- **`AuthMessagePanel`** (feature) is the reassurance panel every recovery and
  session screen shares — one component parameterized by glyph and copy, rather
  than seven near-identical panels.
- **`AuthStatusScreen`** (feature) is the shell for outcome screens: glyph tile,
  `<h1>`, description, optional detail slot, stacked actions, and a note. Email
  sent, password updated, account locked and session expired differ in data, not
  structure, so each stays a declaration.

## Screens

### Splash (`SplashScreen`)

- Brand lockup (`BrandMark`), edition, and release string from `appConfig`.
- A staged boot sequence driven by `useBootSequence`, rendering an ordered
  status line plus a **determinate** `Progress` bar (`aria-valuenow` reflects
  real progress rather than an endless busy state).
- On completion it hands off to whatever `useStartupRoute()` resolved (see
  [Startup flow](#startup-flow)). The screen decides nothing itself; the
  optional `redirectTo` prop only exists to override the policy in tests and
  special cases.

`useBootSequence({ steps, stepDurationMs, onComplete })` is a timer today. When
the platform gains real bootstrap work (session probe, workspace resolution),
each step becomes an awaited promise and the hook is the only file that changes.

### Welcome (`WelcomeScreen`)

- `WelcomeBrandPanel`: product name, a decorative `WorkspacePreview`, the
  positioning statement on a glass panel (`bg-panel` / `border-panel-border`),
  and compliance badges from `AUTH_TRUST_BADGES`.
- Content column: a `Card` with a glyph tile, the page `<h1>`, one line of
  supporting copy, and a single CTA.
- `WelcomeCta` is a real link (`Button asChild` + `next/link`), so it is keyboard
  operable, announces as a link, and works before hydration. Following it is also
  what marks onboarding complete — the flag is a side effect of the click, never
  a precondition for it, so a storage failure costs the visitor nothing but
  seeing welcome again.

### Login (`LoginScreen` + `LoginForm`)

- `LoginBrandPanel`: product name, social proof, and a decorative gradebook
  preview.
- `LoginForm` owns validation, submitting state, and error presentation:

| Concern      | Implementation                                                       |
| ------------ | -------------------------------------------------------------------- |
| Schema       | `loginFormSchema` (Zod) — email, password, `rememberMe`              |
| Form         | `useZodForm` (React Hook Form + `zodResolver`)                       |
| Email        | `TextField` with `startIcon`, `type="email"`, `autoComplete="email"` |
| Password     | `PasswordField` — show/hide toggle, `Forgot password?` `labelAction` |
| Remember me  | `CheckboxField`                                                      |
| Loading      | `formState.isSubmitting` disables controls and swaps in `Spinner`    |
| Field errors | `applyServerFieldErrors` binds `ApiError.fieldErrors` back to fields |
| Form error   | `Alert variant="destructive"` with copy from `getErrorMessage`       |
| SSO          | Rendered **disabled** with a tooltip until federation endpoints ship |

`LoginForm` takes an optional `onSubmit`. It is unset in this phase, so the form
validates and reports without any network call. When the auth mutation lands it
is passed in here — the error paths above already speak `ApiError`, so nothing
else changes.

## Password recovery flow

**The backend resets passwords with an emailed link, not an OTP.** This is the
single most important thing to know about this feature, because the screens were
originally designed the other way round.

```
/forgot-password  →  /email-sent  →  ✉ user clicks the emailed link
                                      ↓
        /password-success  ←  /reset-password?token=…
```

`forgot-password` generates a 32-byte token, stores only its SHA-256 hash, and
emails the raw value inside a link. `reset-password` consumes it: single-use,
expires in 15 minutes, and a successful reset revokes every refresh token, so
all other sessions end immediately.

`verify-otp` returns `{ success }` and **issues no token**, so the OTP endpoints
cannot drive this flow. They stay wired for their real purposes — `LOGIN`,
`MFA`, `EMAIL_VERIFY`, `PHONE_VERIFY` — and the OTP screens are kept for them.

### Where the token comes from

`/reset-password` reads `?token=` from the URL, not from client state:
possession of the email is the authorization. That is why the screen works in a
browser that never saw `/forgot-password` — the normal case, since mail clients
routinely open links elsewhere.

Arriving without a token renders an explanation and a way to request a fresh
link, never a form that cannot succeed.

`store/recovery-store.ts` survives only so `/email-sent` can echo back the
address that was submitted; nothing downstream depends on it.

### Per-screen behavior

| Screen               | Behavior                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Forgot password**  | `TextField` + email validation; records the identifier and advances. Loading state on submit, errors via field binding or a destructive `Alert`. Explicit "Back to login".                                                                                                                                                                                  |
| **Email sent**       | Echoes the address, and offers **no "continue" action** — the flow resumes in the inbox, because the emailed link carries the token. Resend is throttled behind a visible `mm:ss` countdown that mirrors the backend's own limit, so the UI never invites a request the server would reject. "Use a different email" clears the flow and returns to step 1. |
| **OTP verification** | **Not in the recovery path** — reserved for `LOGIN`/`MFA`/`EMAIL_VERIFY`. `OtpField` (six digits), auto-focused. Paste, arrow-key/backspace navigation and `autocomplete="one-time-code"` come from `input-otp` — one real input behind the slots, not six.                                                                                                 |
| **Reset password**   | Reached from the emailed link; reads `?token=`. Two `PasswordField`s with independent show/hide toggles, plus a live strength meter and requirements checklist. Mismatch is reported on the confirmation field.                                                                                                                                             |
| **Password success** | Confirms the outcome; primary CTA to login plus an announced auto-redirect the visitor can ignore.                                                                                                                                                                                                                                                          |

### One password policy, three consumers

The rules live once in `lib/password-strength.ts`. The Zod schema derives its
refinements from them, and `PasswordStrengthMeter` renders the same list — so
what the checklist promises and what validation enforces cannot drift apart.
Changing the policy is a one-file change.

⚠️ **The client policy is stricter than the server's.** The backend enforces
only `@MinLength(8)` on reset, with no complexity requirement. The frontend asks
for 12 characters plus mixed case, a digit and a symbol. That is deliberate —
guidance the server does not yet enforce — but it means a password the backend
would accept can be rejected here. Aligning is a backend change; see
[Backend recommendations](#backend-recommendations).

## Session states

| Screen              | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Account locked**  | Shows the backend's message **verbatim** when it has one, and suppresses the local countdown in that case — the server already states the remaining time, and parsing a duration out of its copy would break the moment that copy changed. Reached directly, it falls back to its own countdown with "Return to login" disabled until the timer clears. Offers two escapes throughout: contact an administrator, or reset the password. |
| **Session expired** | Explains _why_ the session ended rather than just reporting it. "Login again" is one click; the announced auto-redirect is a convenience, never the only route. Renders last-activity detail only when the platform actually knows it.                                                                                                                                                                                                  |

Both lockout and redirect durations are props with sensible defaults — the
backend owns the real windows, and these screens only reflect what it reports.

## Backend integration

### Module layout

| Path                         | Responsibility                                                         |
| ---------------------------- | ---------------------------------------------------------------------- |
| `api/auth.service.ts`        | One function per endpoint. Transport only, on the shared `api` helper. |
| `api/auth.keys.ts`           | Query keys via `createQueryKeys("auth")`.                              |
| `types/auth.dto.ts`          | Wire DTOs mirroring the backend exactly.                               |
| `mappers/auth.mapper.ts`     | Form ↔ wire translation. Every shape difference lives here.            |
| `utils/auth-errors.ts`       | Account-lock detection — the only place that rule exists.              |
| `utils/jwt.ts`               | Unverified claim decoding, for display only.                           |
| `utils/session-manager.ts`   | Token storage choice, single-flight refresh, client wiring.            |
| `hooks/use-*.ts`             | Mutations and queries.                                                 |
| `components/*-connected.tsx` | Thin containers binding mutations to untouched forms.                  |

Screens and forms were **not** modified to integrate: each form already took an
optional `onSubmit`, and a connected container supplies it. That is why the
original component tests still pass unchanged.

### Contract translation

Three differences between the UI and the backend are resolved in the mapper:

- **`email` → `identifier`.** The backend accepts an email, username or phone in
  one field.
- **`rememberMe` is never sent.** It is purely a client decision about where
  tokens live. The backend runs `forbidNonWhitelisted`, so sending it would
  fail the request with a 400.
- **`confirmPassword` never leaves the client.**

### Tokens and refresh

The access token lives **in memory**; the refresh token goes to Web Storage only
when the user asked to be remembered (`createHybridTokenStorage`). A short-lived
credential never touches disk, and an unremembered session cannot outlive the
tab.

`AuthIntegration` — mounted once in the root layout — does the wiring that must
exist before the first request:

1. the `Authorization` header resolves from token storage, replacing the
   platform's `null` placeholder;
2. a 401 triggers **one** silent refresh and **one** replay, through the
   interceptor's existing seam;
3. a surviving refresh token is exchanged for a live session on start-up, so a
   reload does not look like a logout.

Refresh is **single-flight**: concurrent 401s await one shared promise. The
backend rotates and revokes on every use, so parallel refreshes would race and
revoke each other, logging the user out. Recovery is also skipped for
`/auth/login`, `/auth/refresh` and `/auth/logout`, and each request may be
replayed at most once, so a persistently-401 endpoint cannot loop.

### Error routing

| Failure                         | Where it surfaces                                   |
| ------------------------------- | --------------------------------------------------- |
| Invalid credentials             | Inline `Alert` on the form                          |
| **Account locked**              | Routed to `/account-locked`, message shown verbatim |
| Expired/consumed reset token    | Inline `Alert`                                      |
| 401 on an authenticated request | Silent refresh; `/session-expired` if that fails    |
| Anything else                   | Global toast                                        |

Auth mutations set `meta: { skipErrorToast: true }` because their forms render
failures inline — without it a single error would be reported twice.

⚠️ **Field-level errors do not exist on this backend.** Its exception filter
joins class-validator's array into one string, so `applyServerFieldErrors` never
fires against it. It remains wired for a backend that does emit them.

### Identity

`/auth/login` returns only `{ accessToken, refreshToken }`, and there is **no
`/auth/me`**. `AuthUser` is therefore built from the access token's claims
(`sub`, `email`, `role`, `organizationId`, `branchId`), with two honest
fallbacks:

- `name` falls back to the email — no name claim exists.
- `permissions` is empty, so every `can()` check **fails closed** until
  `GET /authorization/me/effective-permissions` is wired. Hiding UI the user may
  be entitled to is the safe direction.

Claims are decoded without signature verification, for display only. The server
is the only party that validates a token.

## Responsive behavior

Mobile-first, no fixed layout widths, no horizontal scroll from 320 → 1920px.

| Width          | Splash                         | Every other auth screen                                     |
| -------------- | ------------------------------ | ----------------------------------------------------------- |
| 320–424        | Single column, fluid padding   | Single column; brand panel not rendered; compact brand mark |
| 425–767        | Same, larger type              | Same; card padding steps up at `sm`                         |
| 768–1023       | Centered, capped content width | Single column, content capped at 27.5rem                    |
| 1024 (`lg`)–up | Unchanged (always centered)    | Two columns: brand panel + content column, 50/50            |
| 1280–1920      | Unchanged                      | Panel padding steps up at `xl`; content stays capped        |

- The brand panel is `hidden lg:flex`, so small screens never download or lay
  out the decoration.
- Panels are `overflow-hidden`, so rotated and blurred artwork can bleed without
  ever producing horizontal page scroll.
- SSO buttons stack on one column below `sm` and pair up from `sm`.
- OTP slots size up at `sm` (`size-11` → `size-13`) and the group stays centered,
  so six slots fit at 320px without wrapping or clipping.
- Stacked actions and the countdown are full-width at every size; nothing relies
  on a fixed pixel width.

## Accessibility

- One `<h1>` per screen, naming the page's task ("Welcome to CampusFlow",
  "Sign in").
- Every control has an accessible name, wired by the form layer
  (`FormLabel`/`FormControl` associate `id`, `aria-describedby`,
  `aria-invalid`). See [Forms](./forms.md).
- The password toggle is a real `<button>` with an action-phrased `aria-label`
  ("Show password" / "Hide password") plus `aria-pressed`, and a visually hidden
  live region announces the change.
- The boot status line is an `aria-live="polite"` region; the progress bar is
  determinate and labelled.
- Disabled SSO buttons carry the reason in their accessible name (a disabled
  button emits no pointer events, so the tooltip alone would be unreachable).
- Decoration — glyph tiles, orbs, previews — is `aria-hidden`.
- Countdowns (resend throttle, lockout, auto-redirect) are `aria-live="polite"`,
  so the state change is announced rather than left as a silent surprise.
- The password requirements checklist is a polite live region and states
  met/not-met in text, so the strength meter can stay purely decorative.
- The OTP field's visible slots are backed by a single labelled input, keeping
  the accessible name accurate and paste/autofill working.

## Motion

- Entrance staging uses `FadeIn` (`shared/components/motion`), which renders the
  final state immediately under `prefers-reduced-motion`.
- The splash logo's breathing loop is a Motion animation gated on
  `useReducedMotion()`.
- Boot timing is **not** motion — it is information, so it is unaffected by the
  reduced-motion preference.

## Theming

Every surface is styled with semantic tokens, so a future workspace theme
restyles the auth screens with no component change:

| Token                                 | Used for                             |
| ------------------------------------- | ------------------------------------ |
| `bg-canvas`, `bg-canvas-accent`       | Full-bleed brand canvas and its orbs |
| `bg-panel`, `border-panel-border`     | Glassmorphic overlay panel           |
| `shadow-ambient`, `shadow-ambient-lg` | Diffused, ink-tinted brand elevation |
| `bg-primary`, `text-primary`          | Brand glyph tiles, wordmark, CTAs    |

See [Future Theme Integration](./theme-integration.md).

## Public surface

Import only from the feature barrel — never a file inside it:

```ts
import {
  LoginScreen,
  ResetPasswordScreen,
  resetPasswordFormSchema,
  useRecoveryStore,
} from "@/features/auth";
```

Startup routing is platform, not feature, so it comes from core:

```ts
import { completeOnboarding, useStartupRoute } from "@/core/startup";
```

## Tests

| File                                             | Covers                                                         |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `tests/unit/login-schema.test.ts`                | Credential validation rules and defaults                       |
| `tests/unit/recovery-schema.test.ts`             | Email, OTP shape, password policy, confirmation mismatch       |
| `tests/unit/password-strength.test.ts`           | Scoring, levels, per-rule checklist ordering                   |
| `tests/unit/use-boot-sequence.test.ts`           | Step progression, progress math, single completion             |
| `tests/unit/use-countdown.test.ts`               | `mm:ss` formatting, single completion, restart                 |
| `tests/unit/startup-route.test.ts`               | Startup policy branches; storage key, reset, and failure modes |
| `tests/integration/auth-splash.test.tsx`         | Brand content, determinate progress, live region, hand-off     |
| `tests/integration/auth-welcome.test.tsx`        | Heading level, CTA link target, release small print            |
| `tests/integration/auth-login.test.tsx`          | Labels, validation, submit payload, password toggle, errors    |
| `tests/integration/auth-startup-flow.test.tsx`   | First-run vs returning routing; onboarding marked at hand-off  |
| `tests/integration/auth-recovery-flow.test.tsx`  | All four recovery steps: validation, guards, paste, throttle   |
| `tests/integration/auth-session-states.test.tsx` | Lockout gating, guidance, auto-redirects, optional detail      |

Screens that navigate need the App Router mock (`@tests/mocks/next-navigation`)
— see [Testing Strategy](./testing.md). Tests that click through `userEvent`
must not run under fake timers; the countdown assertions and the interaction
assertions therefore live in separate `describe` blocks.

## Backend contract

The Postman collection is the source of truth for these routes; nothing here is
invented and nothing is called yet. The backend exposes auth under the versioned
base (`<NEXT_PUBLIC_API_URL>/<NEXT_PUBLIC_API_VERSION>`, i.e. `.../v1`), so
services call version-agnostic paths — see [API Layer](./api-layer.md).

| Path                        | Method     | Payload / notes                | Screen               |
| --------------------------- | ---------- | ------------------------------ | -------------------- |
| `/auth/login`               | POST       | `{ identifier, password }`     | Login                |
| `/auth/forgot-password`     | POST       | `{ email }`                    | Forgot password      |
| `/auth/send-otp`            | POST       | `{ identifier, purpose }`      | Email sent           |
| `/auth/resend-otp`          | POST       | `{ identifier, purpose }`      | Email sent · OTP     |
| `/auth/verify-otp`          | POST       | `{ identifier, purpose, otp }` | OTP verification     |
| `/auth/reset-password`      | POST       | `{ token, password }`          | Reset password       |
| `/auth/refresh`             | POST       | Rotates the access token       | Session expired      |
| `/auth/logout`              | POST       | `?allDevices=`                 | (workspace)          |
| `/auth/verify-email`        | POST       | `{ email, otp }`               | (email verification) |
| `/auth/resend-verification` | POST       | `{ email }`                    | (email verification) |
| `/auth/sessions`            | GET/DELETE | List, or revoke all            | (session management) |
| `/auth/sessions/:id`        | DELETE     | Revoke one session             | (session management) |

Verified against the backend source, not only the Postman collection — the
collection documents routes and request bodies but records **no response
bodies**, and is wrong about logout (it omits the required body and marks
`allDevices` required when it is optional).

### Verified policies

| Policy                 | Value                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Access token lifetime  | 15 minutes                                                                         |
| Refresh token lifetime | 7 days, rotated and revoked on every use                                           |
| Account lockout        | 5 failed attempts → 10 minutes                                                     |
| Reset token            | Single-use, 15-minute expiry, SHA-256 at rest                                      |
| OTP                    | Exactly 6 digits, 10-minute TTL, 5 attempts, 60-second resend cooldown             |
| Password (server)      | `@MinLength(8)` on reset only — no complexity rule                                 |
| CORS                   | `Access-Control-Allow-Origin: *`, no credentials → `withCredentials` stays `false` |

## Backend recommendations

None of these block the integration; each removes a workaround.

1. **Emit a dedicated `ACCOUNT_LOCKED` code.** The exception filter sets `code`
   to the thrown class name, so a lockout is indistinguishable from any other 403. Detection currently needs a message match as well — narrow, isolated in
   `utils/auth-errors.ts`, and deletable the day a real code exists.
2. **Add `GET /auth/me`.** Login returns only tokens, so `name` falls back to
   the email and `permissions` starts empty.
3. **Enforce the password policy server-side**, or tell us the real one so the
   client can match it.
4. **Make `send-otp` generic on an unknown identifier.** It currently 404s,
   leaking account existence — `forgot-password` deliberately does not.
5. **Fix the Postman collection**: logout's body and `allDevices` optionality.

## What lands next

1. **Permissions** — wire `GET /authorization/me/effective-permissions` so
   `can()` stops failing closed.
2. **Startup routing** — `useStartupRoute` awaits a session probe and passes the
   result to `resolveStartupRoute`'s existing `session` parameter.
3. **Session management UI** — the hooks (`useSessions`, `useRevokeSession`,
   `useRevokeAllSessions`) are wired and tested; no screen consumes them yet.
4. **OTP flows** — the screens and hooks exist for `LOGIN`/`MFA`/`EMAIL_VERIFY`;
   none is currently reachable from a route.
