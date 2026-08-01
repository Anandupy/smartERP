# Authentication Screens

The auth feature (`src/features/auth`) owns every screen a visitor sees before
they have a session. This page documents what ships today, how it is composed,
and where the not-yet-built pieces plug in.

> **Scope of this phase.** Every authentication screen is implemented as **UI
> only** — no credential request is made, no session is created, no token is
> read. Each form takes an optional `onSubmit`; that prop is where the mutation
> slots in. See [Backend contract](#backend-contract-not-wired-yet).

## Routes

| Route               | Screen component        | Purpose                                                        |
| ------------------- | ----------------------- | -------------------------------------------------------------- |
| `/splash`           | `SplashScreen`          | Brand entry + boot sequence; asks the startup flow where to go |
| `/welcome`          | `WelcomeScreen`         | First-run brand introduction + single CTA into login           |
| `/login`            | `LoginScreen`           | Credential entry                                               |
| `/forgot-password`  | `ForgotPasswordScreen`  | Recovery step 1 — request a code                               |
| `/email-sent`       | `EmailSentScreen`       | Recovery step 2 — confirmation, resend, change email           |
| `/verify-otp`       | `OtpVerificationScreen` | Recovery step 3 — enter the six-digit code                     |
| `/reset-password`   | `ResetPasswordScreen`   | Recovery step 4 — choose a new password                        |
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

Four screens, one linear path:

```
/forgot-password → /email-sent → /verify-otp → /reset-password → /password-success
```

### Carrying state between steps

Each step needs what the previous one produced, so the feature owns a small
Zustand store (`store/recovery-store.ts`) holding the identifier, whether a code
was verified, and the reset token.

It is **not persisted and not in the URL**, on purpose: the email identifies an
account and the reset token authorizes a password change, so neither belongs in
browser history, bookmarks, or server logs. The cost is that a reload drops the
flow — `RecoveryFlowGuard` catches that and offers a clean restart rather than
rendering a screen addressed to nobody. `/reset-password` additionally requires
a _verified_ code, so the final step cannot be reached by typing its URL.

### Per-screen behavior

| Screen               | Behavior                                                                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Forgot password**  | `TextField` + email validation; records the identifier and advances. Loading state on submit, errors via field binding or a destructive `Alert`. Explicit "Back to login".                                                                                |
| **Email sent**       | Echoes the address it was sent to. Resend is throttled behind a visible `mm:ss` countdown that mirrors the backend's own limit, so the UI never invites a request the server would reject. "Use a different email" clears the flow and returns to step 1. |
| **OTP verification** | `OtpField` (six digits), auto-focused. Paste, arrow-key/backspace navigation and `autocomplete="one-time-code"` come from `input-otp` — one real input behind the slots, not six. Same throttled resend.                                                  |
| **Reset password**   | Two `PasswordField`s with independent show/hide toggles, plus a live strength meter and requirements checklist. Mismatch is reported on the confirmation field.                                                                                           |
| **Password success** | Confirms the outcome; primary CTA to login plus an announced auto-redirect the visitor can ignore.                                                                                                                                                        |

### One password policy, three consumers

The rules live once in `lib/password-strength.ts`. The Zod schema derives its
refinements from them, and `PasswordStrengthMeter` renders the same list — so
what the checklist promises and what validation enforces cannot drift apart.
Changing the policy is a one-file change.

## Session states

| Screen              | Behavior                                                                                                                                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Account locked**  | States the reason, counts down to unlock, and keeps "Return to login" **disabled** until the timer clears so the screen never invites an attempt that would extend the lockout. Offers the two useful escapes meanwhile: contact an administrator, or reset the password. Closes with concrete retry guidance. |
| **Session expired** | Explains _why_ the session ended rather than just reporting it. "Login again" is one click; the announced auto-redirect is a convenience, never the only route. Renders last-activity detail only when the platform actually knows it.                                                                         |

Both lockout and redirect durations are props with sensible defaults — the
backend owns the real windows, and these screens only reflect what it reports.

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

## Backend contract (not wired yet)

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

### Shape mismatches to resolve when wiring

- **`identifier` vs `email`.** The backend accepts one `identifier` (email,
  username, or phone); the login and forgot-password forms model `email`,
  because the designs ask for an institutional address. The service maps
  `{ email, … }` → `{ identifier, … }`. Widening to accept a username or phone
  is a schema + label change, not an architectural one — the recovery store
  already calls the value `identifier`.
- **`purpose`.** OTP endpoints are shared across flows and take a `purpose`
  (`"LOGIN"`, and whatever the reset flow uses). It is a request field, not UI
  state, so it belongs in the service call, not the form.
- **The reset `token`.** `/auth/reset-password` takes the token issued by OTP
  verification. `recovery-store` already carries a `resetToken`, set from
  `completeVerification(...)` and read by `ResetPasswordForm`; it is `null`
  today and needs no new plumbing.
- **`rememberMe`** is a client-side token-storage decision (`core/auth` token
  storage), not a request field.

## What lands next

1. **Auth mutations** — an `auth.service.ts` on `createResourceService`, keys on
   `createQueryKeys`, and one mutation hook per endpoint. Pass each hook's
   `mutateAsync` as the matching form's `onSubmit`; the loading, field-error and
   form-error paths already work.
2. **Session hand-off** — `AuthProvider.setSession` on successful login, and the
   token provider registered on `headerRegistry` (see
   [API Layer](./api-layer.md)).
3. **Real startup routing** — `useStartupRoute` awaits session validation and
   passes the result to `resolveStartupRoute`'s existing `session` parameter.
   The onboarding flag stays and keeps working independently.
4. **Session expiry wiring** — the 401 seam in the response interceptor attempts
   `/auth/refresh` and routes to `/session-expired` only when the refresh token
   is genuinely gone; `/account-locked` is driven by the lockout error the
   backend returns from `/auth/login`.
