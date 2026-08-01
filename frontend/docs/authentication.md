# Authentication Screens

The auth feature (`src/features/auth`) owns every screen a visitor sees before
they have a session. This page documents what ships today, how it is composed,
and where the not-yet-built pieces plug in.

> **Scope of this phase.** Splash, welcome, and login are implemented as **UI
> only** — no credential request is made, no session is created. The recovery
> screens (forgot password, OTP, reset password, password success, session
> expired, account locked) are later phases and are deliberately absent.

## Routes

| Route      | Page                          | Screen component | Purpose                                           |
| ---------- | ----------------------------- | ---------------- | ------------------------------------------------- |
| `/splash`  | `app/(auth)/splash/page.tsx`  | `SplashScreen`   | Brand entry + boot sequence, hands off to welcome |
| `/welcome` | `app/(auth)/welcome/page.tsx` | `WelcomeScreen`  | Brand introduction + single CTA into login        |
| `/login`   | `app/(auth)/login/page.tsx`   | `LoginScreen`    | Credential entry                                  |

Paths are declared once in `constants/routes.ts` (`ROUTES.auth.*`) — never
spelled inline. Pages are thin server components that set `metadata` and render
one feature component; all interactivity lives in the feature.

### Route group and guarding

`app/(auth)/layout.tsx` wraps the group in `GuestRoute` only. It deliberately
does **not** impose a shell, because auth screens legitimately differ: splash is
full-bleed, welcome and login are two-column, and later recovery screens use the
centered `AuthLayout`. Each screen picks its own shell.

## Layout composition

```
(auth)/layout.tsx → GuestRoute
  └── SplashScreen  → AuthBrandPanel                    (full-bleed)
  └── WelcomeScreen → AuthSplitLayout + WelcomeBrandPanel
  └── LoginScreen   → AuthSplitLayout + LoginBrandPanel
```

- **`AuthSplitLayout`** (`components/layouts`) is generic structure: a brand
  panel beside a centered content column, with a `footer` slot. It contains no
  brand content — the feature injects every pixel of it. See
  [Layouts](./layouts.md).
- **`AuthBrandPanel`** (feature) is the decorative canvas shared by all brand
  moments: brand canvas, a token-tinted dot grid, and two blurred ambient orbs.
  Every layer is `aria-hidden` and `pointer-events-none`.

## Screens

### Splash (`SplashScreen`)

- Brand lockup (`BrandMark`), edition, and release string from `appConfig`.
- A staged boot sequence driven by `useBootSequence`, rendering an ordered
  status line plus a **determinate** `Progress` bar (`aria-valuenow` reflects
  real progress rather than an endless busy state).
- On completion it calls `router.replace(redirectTo)` — default
  `ROUTES.auth.welcome`. `redirectTo` is the routing seam: once the session
  probe lands, an authenticated visitor is sent to the workspace instead and
  only this prop changes.

`useBootSequence({ steps, stepDurationMs, onComplete })` is a timer today. When
the platform gains real bootstrap work (session probe, workspace resolution),
each step becomes an awaited promise and the hook is the only file that changes.

### Welcome (`WelcomeScreen`)

- `WelcomeBrandPanel`: product name, a decorative `WorkspacePreview`, the
  positioning statement on a glass panel (`bg-panel` / `border-panel-border`),
  and compliance badges from `AUTH_TRUST_BADGES`.
- Content column: a `Card` with a glyph tile, the page `<h1>`, one line of
  supporting copy, and a single CTA.
- The CTA is a real link (`Button asChild` + `next/link`), so it is keyboard
  operable, announces as a link, and works before hydration.

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

## Responsive behavior

Mobile-first, no fixed layout widths, no horizontal scroll from 320 → 1920px.

| Width          | Splash                         | Welcome / Login                                             |
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
import { LoginScreen, loginFormSchema, useBootSequence } from "@/features/auth";
```

## Tests

| File                                      | Covers                                                      |
| ----------------------------------------- | ----------------------------------------------------------- |
| `tests/unit/login-schema.test.ts`         | Credential validation rules and defaults                    |
| `tests/unit/use-boot-sequence.test.ts`    | Step progression, progress math, single completion          |
| `tests/integration/auth-splash.test.tsx`  | Brand content, determinate progress, live region, hand-off  |
| `tests/integration/auth-welcome.test.tsx` | Heading level, CTA link target, release small print         |
| `tests/integration/auth-login.test.tsx`   | Labels, validation, submit payload, password toggle, errors |

Screens that navigate need the App Router mock (`@tests/mocks/next-navigation`)
— see [Testing Strategy](./testing.md).

## Backend contract (for the next phase — not wired yet)

The backend exposes auth under the versioned base
(`<NEXT_PUBLIC_API_URL>/<NEXT_PUBLIC_API_VERSION>`, i.e. `.../v1`), so services
call version-agnostic paths — see [API Layer](./api-layer.md).

| Path                    | Method     | Notes                              |
| ----------------------- | ---------- | ---------------------------------- |
| `/auth/login`           | POST       | `{ identifier, password }`         |
| `/auth/refresh`         | POST       | Rotates the access token           |
| `/auth/logout`          | POST       | `?allDevices=`                     |
| `/auth/forgot-password` | POST       | `{ email }`                        |
| `/auth/reset-password`  | POST       | `{ token, password }`              |
| `/auth/send-otp`        | POST       | `{ identifier, purpose }`          |
| `/auth/verify-otp`      | POST       | `{ identifier, purpose, otp }`     |
| `/auth/sessions`        | GET/DELETE | Active sessions; revoke one or all |

Note the shape mismatch to resolve when wiring: the backend accepts a single
`identifier` (email, username, or phone), while this phase's form models an
`email` field because the design asks for an institutional email. The service
maps `{ email, password }` → `{ identifier, password }`; widening the field to
accept a username or phone is a schema + label change in
`loginFormSchema`/`LoginForm`, not an architectural one. `rememberMe` is a
client-side token-storage decision (`core/auth` token storage), not a request
field.

## What lands next

1. **Auth mutation** — a `login.service.ts` on `createResourceService`, a
   `useLogin` mutation, and `AuthProvider.setSession` on success. Pass the
   mutation's `mutateAsync` as `LoginForm`'s `onSubmit`.
2. **Recovery screens** — forgot password, OTP, reset password, password
   success, session expired, account locked, each as its own route in `(auth)`.
3. **Authorization header** — register the token provider on `headerRegistry`
   (see [API Layer](./api-layer.md)).
