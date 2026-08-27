# End-to-end tests

Most Playwright specs in this directory run against a real, running backend
(`playwright.config.ts` auto-starts `pnpm dev`, but nothing starts the
backend — it must already be reachable at the URL `NEXT_PUBLIC_API_URL`
resolves to). `branch-guide-target-reliability.spec.ts` is the one
exception — see below — and needs neither a backend nor credentials.

## Authenticated specs

`fixtures/auth.ts` drives the real `/login` UI — never a token injection or
any other bypass of `core/auth`/`features/auth` — to reach an authenticated,
workspace-ready state. It needs a real account:

```bash
E2E_TEST_EMAIL=someone@example.com E2E_TEST_PASSWORD=... pnpm test:e2e
```

These are read directly from `process.env` in test files under `tests/`, not
through `@/config`'s validated `env` module — that module is the
application's client-readable `NEXT_PUBLIC_*` boundary (`AGENTS.md` §17);
Playwright specs run in Node, outside the Next.js bundle entirely, so this is
a different, legitimate boundary rather than an exception to that rule.

Without both variables set, any spec built on `authenticatedPage` skips
itself with an explanatory message — it does not fail, and it does not fall
back to a fake session.

The test account needs whatever role/permissions the flow under test
requires. `academic-year-guide.spec.ts`, for instance, needs an account that
can reach `/app/academic-years` and use its create/lifecycle actions.

## `academic-year-guide.spec.ts`

Exercises the Academic Years guide end to end: start the guide, create a real
academic year, follow the guide across routes to Lifecycle, and activate it.

This performs a real, **irreversible** activation — the API documents no
deactivate — and creates a real record every run (its name is timestamped so
it never collides with a previous run, but nothing deletes it afterward).
Repeated runs accumulate academic-year records against whatever branch the
test account resolves to. That is an accepted, deliberate cost of a
genuinely end-to-end guide test, not an oversight — a disposable/seeded test
branch is the natural mitigation if this becomes a problem, but building one
was out of scope for this pass.

## `branch-guide-target-reliability.spec.ts`

Needs neither `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` nor a live backend — it
runs standalone with just `pnpm dev` auto-started. Every backend call is
intercepted at the network boundary (`page.route`) and answered with the
same fixture shapes the Vitest/MSW suite uses; `core/auth`'s real login
flow, real token handling and real workspace resolution all run unmodified,
so this is not an auth bypass, just a faked backend origin.

This is the guide platform's own target-resolution regression suite —
see `docs/guides.md` §15/§16 for exactly what it protects against and why
each assertion exists. It is the pattern to reach for first for any future
guide-platform regression that doesn't specifically need to prove a real
backend contract: deterministic, fast (single digit seconds), and runs in
CI with no secrets.

Desktop only (`test.skip` on `isMobile`) — the mobile viewport's off-canvas
sidebar needs its own open/close interaction before any nav link is
reachable, a separate responsive-nav flow this spec does not attempt.
