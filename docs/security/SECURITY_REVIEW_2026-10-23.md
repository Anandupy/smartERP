# CampusFlow ERP — Security Review

**Date:** 23 Oct 2026 · **Scope:** `backend/` (NestJS API), `frontend/` (Next.js app, incl. the new admission-scanning routes) · **Method:** white-box code review + safe live verification against the **local dev** servers only (`localhost:3001`, `localhost:3000`).

> Treat this file as **confidential** — it describes weaknesses in a live system. Share only with people who will fix them.

## Summary

| Severity | Count | Verified live |
|---|---|---|
| 🔴 Critical | 1 | — (published advisory) |
| 🟠 High | 2 | 1 |
| 🟡 Medium | 8 | 7 |
| 🔵 Low / Info | 5 | 2 |

**Fix first:** (1) upgrade Next.js, (2) lock down `POST /communication/notifications`, (3) close the "no branch = every branch" gap, (4) restrict OTP generation.

The core design is solid — see [What is already done well](#what-is-already-done-well). Most findings are a missing check on a handful of routes, not systemic flaws.

---

## 🔴 Critical

### C1. Next.js 16.2.12 has unauthenticated remote-code-execution advisories
- **Where:** `frontend/package.json` → `next@16.2.12`.
- **Issue:** `pnpm audit` reports 5 critical Next.js advisories fixed in **≥ 16.4.1**, including *"Unauthenticated Remote Code Execution on windows-hosted servers"* — this deployment runs on Windows — and RCE in the Image Optimization API (AVIF/SVG) and `use cache`.
- **Impact:** an attacker who can reach the frontend server could run code on it without logging in.
- **Fix:** `pnpm --dir frontend add next@^16.4.1 eslint-config-next@^16.4.1`, rebuild, re-run tests. Until then, don't expose port 3000 beyond the office network.
- **Not exploited** during this review — rated from the vendor advisories.

## 🟠 High

### H1. Any logged-in user can send in-app notifications to anyone, in any organisation — **verified**
- **Where:** `backend/src/modules/communication/notification/in-app-notification.controller.ts` — `POST /v1/communication/notifications` (labelled "Admin/Service use") has **no `@RequirePermission`/`@Roles`**; the service writes `userId`, `organizationId`, `branchId`, `title`, `content`, `actionUrl` straight from the request body.
- **Proof (local):** a new STAFF test account created a notification titled "SECURITY TEST" with an external link in the **admin's** inbox (HTTP 200; visible to the admin).
- **Impact:** a parent/student/staff account can plant convincing fake alerts ("Fee overdue — pay here") with a phishing link for any user, including in other schools on the same installation.
- **Fix:** add `@Roles(SUPER_ADMIN, ORG_ADMIN, BRANCH_ADMIN)` + a permission; take `organizationId`/`branchId` from the request context, never the body; verify the target `userId` belongs to that tenant; validate `actionUrl` (`@IsUrl({ protocols: ['https'] })` or relative app paths only).

### H2. Users with no assigned branch can act in every branch of their organisation
- **Where:** `backend/src/modules/context/services/context-validator.service.ts` `validateBranch()` — the restriction runs only `if (userBranchId && userBranchId !== branch.id)`.
- **Issue:** for STAFF / STUDENT / PARENT users whose `branchId` is null, **any** `x-branch-id` header in their organisation is accepted (fail-open). Verified that a branch-less STAFF test account's requests are accepted with a branch header; a cross-branch read could not be shown because the dev organisation has a single branch.
- **Impact:** in a trust running several schools, a teacher or parent created without a branch can read/act on other schools' applicants and records within their permissions.
- **Fix:** fail closed — for roles other than SUPER_ADMIN/ORG_ADMIN, refuse when `userBranchId` is null; or require an explicit user↔branch assignment table.

## 🟡 Medium

### M1. OTP generation can be aimed at any phone/email with weak settings — **verified**
- `POST /v1/communication/otp/generate` (no permission check) lets any logged-in user choose `identifier`, `purpose`, `length` (min **4**) and `ttlMinutes` (max **60**). Verified: the STAFF test account triggered a 4-digit, 60-minute `EMAIL_VERIFY` code to another address. A 60-second resend cooldown applies.
- **Impact:** SMS/email bombing at the school's cost; weaker codes for another user's email verification.
- **Fix:** allow only the caller's own identifier (or an admin permission); fix length (6) and TTL (≤10 min) server-side; rate-limit authenticated OTP calls.

### M2. Message templates insert values without HTML-escaping
- `backend/src/modules/communication/renderer/handlebars-template.renderer.ts` is a regex replace (not Handlebars) that puts variable values **raw** into `bodyHtml`; the frontend preview renders `bodyHtml` with `dangerouslySetInnerHTML` and no sanitiser.
- **Impact:** a name containing HTML (typed or OCR-read) is injected into official school emails (links/images); a malicious template author can run script in a higher admin's browser when previewed.
- **Fix:** HTML-escape variables when rendering `bodyHtml`; sanitise `bodyHtml` before display (DOMPurify).

### M3. Anyone can lock any account they know the email of — **verified**
- 5 wrong passwords lock an account for 10 minutes, keyed on the account only (`auth.service.ts` `handleFailedLogin`). Verified on the test account (6th attempt: "Account locked").
- **Impact:** an outsider can keep the principal/admin locked out indefinitely; the message also confirms the account exists.
- **Fix:** progressive delay instead of a hard lock, or lock per IP+account; generic message; consider CAPTCHA after failures.

### M4. Registered emails can be discovered — **verified**
- `POST /v1/auth/resend-verification` (and `verify-email`) answer "User not found with email …" for unknown addresses vs success for real ones. Login also returns faster for unknown emails (no password check).
- **Fix:** identical responses for both cases (as `forgot-password` already does); run a dummy bcrypt compare for unknown users.

### M5. Full API documentation is public in every environment — **verified**
- `main.ts` mounts Swagger at `/docs` and the full spec at `/api-json` unconditionally. Verified: both return 200 without login (155 endpoints listed).
- **Fix:** mount only when `NODE_ENV !== 'production'`, or behind auth.

### M6. Frontend sends no security headers — **verified**
- `frontend/next.config.ts` sets no headers; responses carry only `X-Powered-By: Next.js` (the API itself has good helmet headers).
- **Impact:** clickjacking of the ERP UI, no CSP to contain script injection.
- **Fix:** add `headers()` with `Content-Security-Policy` (incl. `frame-ancestors 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`; set `poweredByHeader: false`.

### M7. Admission-scanning routes: any role, no rate limit, heavy CPU — **verified**
- `frontend/src/app/api/admissions/ocr/route.ts` and `/batch/route.ts` check only that the caller is logged in (any role, incl. PARENT); a batch can run OCR on up to 80 pages. Verified: a small non-form image cost ~5 s of server OCR before being rejected. No concurrency cap; `sharp` uses its default 268-megapixel input limit. When Claude is enabled, form images (incl. Aadhaar numbers) are sent to an external API.
- **Fix:** require an admissions permission (check via the backend), cap concurrent scans per user/server, set `limitInputPixels` (~50 MP); record a data-processing note before enabling Claude.
- *These routes were added in this project's recent work — the fix is ours to make.*

### M8. Vulnerable backend dependencies
- `pnpm audit --prod`: 1 critical (`proxy-addr` IP spoofing — matters only if `TRUST_PROXY` is enabled), 7 high (`multer` upload DoS, `js-yaml`), 8 moderate (`qs`, `uuid`). Frontend also lists `shadcn` (a CLI) as a **production** dependency, pulling in an Express server.
- **Fix:** update `@nestjs/platform-express`/`express`/`multer`; move `shadcn` to `devDependencies`; add `pnpm audit` to CI.

## 🔵 Low / Info

- **L1. Refresh token in localStorage** (with "Remember me"): any future XSS could steal a 7-day session. Prefer an HttpOnly, Secure, SameSite cookie.
- **L2. Error messages echo internal IDs/names** ("Organization '…' not found" vs "no access") — allows probing which IDs exist. Use one generic 404/403.
- **L3. Notification `actionUrl` is any string** — not rendered as a link today, but would become script injection (`javascript:` URL) once it is.
- **L4. Development configuration must not reach production:** admin password is 9 chars (`admin1234`), `JWT_SECRET` is 29 chars (below the app's own 32-char rule, enforced only in production), and the app connects as the **postgres superuser**. Use a least-privilege DB role.
- **L5. Aadhaar numbers stored in plaintext** on Applicant/Guardian (already listed in `backend-gaps.md`). A compliance issue under the Aadhaar Act / DPDP Act; plan encryption or tokenisation.

## What is already done well

- Passwords hashed with **bcrypt (cost 12)**; refresh tokens **hashed and rotated** (single use).
- OTPs from `crypto.randomInt`, stored **hashed**, attempt-limited, older codes invalidated.
- Global `ValidationPipe` with **whitelist + forbidNonWhitelisted**; **helmet** on the API; **CORS allow-list** enforced in production.
- **216 of 236** routes carry role/permission checks; tenant scope resolved centrally (`ExecutionContextGuard`).
- Document uploads: role + permission checks, owner scoped to the organisation, **MIME sniffing**, size limits.
- **No SQL injection** found — raw SQL uses bound parameters; login rate limit now scoped correctly (fixed earlier today).
- **No secrets committed** to git (only `.env.example` files).

## Test artefacts left in the local dev database

- User **`sec-test-staff@example.test`** (STAFF, no branch) — currently locked for 10 minutes by test M3. Deactivate or delete it from Users when no longer needed.
- One "SECURITY TEST" notification in the admin's inbox (archived after the test).
- One `EMAIL_VERIFY` OTP for `someone-else@example.test` (non-routable test domain; expires in 60 min).

## Suggested fix order

1. **Today:** C1 (upgrade Next.js), H1, H2.
2. **This week:** M1, M2, M5, M6, M7.
3. **Next sprint:** M3, M4, M8, L1–L4.
4. **Planned:** L5 (Aadhaar encryption).
