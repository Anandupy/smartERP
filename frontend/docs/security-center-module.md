# Account & Security Center Module

`src/features/security` — the signed-in user's own sessions, sign-out
controls, and account-security screens. Reached from the profile menu
(`Account & security`), routed under `/app/account/security`.

## Source of truth

Unlike the other administration modules, this one's contract was verified
against **backend source**, not only docs/Postman:
`backend/src/modules/auth/auth.controller.ts`, `auth.service.ts`,
`dto/auth-response.dto.ts`, and the Prisma `User`/`RefreshToken` models. The
Postman collection's session/logout examples matched the controller; the
brief's assumption about a `POST /auth/sessions/revoke-all` endpoint did not
(the real endpoint is `DELETE /auth/sessions`) — reading the controller
directly resolved it.

## Architecture

No second session layer. `GET/DELETE /auth/sessions` and `POST /auth/logout`
were already wired in `src/features/auth` (`authService`, `useSessions`,
`useRevokeSession`, `useRevokeAllSessions`, `useLogout`) before this module
existed. Every screen here imports those hooks and `AuthSessionDto` from
`@/features/auth`'s public surface rather than re-implementing them, per
AGENTS.md §4/§27. Identity (name/email/role) comes from `useAuth()` in
`@/core/auth` — the same source `ProfileMenu` already reads — not a second
call to `/auth/me`.

`PendingSettingsGroup` (real, disabled controls + `BackendPendingNote` +
disabled save) was promoted from `features/branch/settings` to
`shared/components/feedback` as part of this module, since it is generic UI
plumbing every backend-pending settings screen needs, not branch domain
knowledge. `features/branch` re-exports it unchanged for its own existing
imports.

## Verified contract

| Capability | Endpoint | Status |
| --- | --- | --- |
| List sessions | `GET /auth/sessions` → `{id, device, ipAddress, userAgent, createdAt}[]` | Real |
| Revoke one session | `DELETE /auth/sessions/:id` | Real |
| Revoke every session | `DELETE /auth/sessions` | Real, but **not used by this UI** — see below |
| Sign out | `POST /auth/logout?allDevices=true\|false`, body `{refreshToken}` | Real |
| Identity | `useAuth()` (JWT claims: name, email, role) | Real, already platform state |
| Authenticated change password | — | Missing |
| 2FA enrollment/enable/disable/TOTP/backup codes | — | Missing (schema placeholder only, never written) |
| Security preferences | — | Missing |
| Login history | — | Missing |
| Security activity feed | — | Missing (auth events are never emitted to `/audit-logs`) |
| Trusted devices | — | Missing (no model, no controller) |

Full gap detail with impact and current behaviour: `docs/backend-gaps.md` §J.

## Decisions worth recording

**"Sign out everywhere" always uses `POST /auth/logout?allDevices=true`, never
`DELETE /auth/sessions`.** Both revoke every refresh token for the user —
`auth.service.ts` confirms `revokeAllSessions` and `logout(allDevices=true)`
run the identical Prisma `updateMany`, with no exclusion for the caller's own
token. But `useLogout` also clears local tokens/session and redirects once the
call settles; `useRevokeAllSessions` only invalidates the sessions query. Using
the latter for a user-facing "sign out everywhere" button would leave the
current tab server-side signed-out but still rendering the app until its
access token happened to expire. So every such control — the Active Sessions
bulk action and both Danger Zone "sign out" actions — is `useLogout`, and its
confirmation copy says plainly that this device is included, since the
backend has no way to exclude it.

**No session is ever labeled "this device" or "current."**
`AuthSessionDto` carries no such flag — confirmed against the DTO and the
existing `use-sessions.ts` doc comment, which made the same observation
before this module existed. Guessing from the browser's own user-agent was
considered and rejected: it would occasionally guess wrong, and a wrong
"current device" label is worse than none.

**`userAgent` is displayed as the raw string the backend recorded**, in the
Session Details Drawer, rather than parsed into a Browser/OS breakdown the
response never returned as structured data.

**Two-Factor Authentication never states a status.** Not "enabled," not
"disabled" — `isTwoFactorEnabled` is in the Prisma schema but is never
selected into `UserProfileDto`/`AuthMeDto`, and the column comment states 2FA
is unimplemented. The screen says the status is unavailable. Login-time OTP
(`purpose: MFA`) is real and unrelated — it is noted as already-available at
sign-in, but never presented as evidence that Security-Center-managed 2FA is
on.

**The generic Audit Logs module (`/audit-logs`) is not repurposed as a
security-activity feed.** It records domain data mutations via an event
listener; `auth.service.ts` never emits to it, so it contains no login,
logout or session-revoke events. Security Activity Audit ships as a complete,
inert UI instead of quietly showing an unrelated log.

**No security score.** The Stitch dashboard mockup showed a fabricated "84
Excellent" badge, fake password age, and a geolocated "last login" — none of
which the backend can produce. The dashboard shows only what is verifiable:
identity and the live session count.

## Screens

| Screen | Route | Backend |
| --- | --- | --- |
| Account & Security Dashboard | `/app/account/security` | Identity + session count (real); every other section links out, pending sections badged |
| Active Sessions | `/app/account/security/sessions` | Real |
| Session Details Drawer | (drawer on Active Sessions) | Real — built from the row already loaded, no `GET /:id` |
| Login History | `/app/account/security/login-history` | Backend Pending |
| Change Password | `/app/account/security/change-password` | Backend Pending |
| Two-Factor Authentication | `/app/account/security/two-factor` | Backend Pending |
| Security Preferences | `/app/account/security/preferences` | Backend Pending |
| Security Activity Audit | `/app/account/security/audit` | Backend Pending |
| Danger Zone | `/app/account/security/danger-zone` | Partial — sign out (this device / everywhere) real; deactivate/delete pending |
| Trusted Devices | `/app/account/security/trusted-devices` | Backend Pending |

## Testing

`tests/mocks/auth-handlers.ts` already covers `GET/DELETE /auth/sessions` and
`POST /auth/logout` — no new MSW handlers were needed. The six fully-pending
screens have no handlers at all; MSW's repo-wide `onUnhandledRequest: "error"`
is what proves they never call out.
