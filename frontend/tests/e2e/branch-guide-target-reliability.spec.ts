import { expect, test, type Page } from "@playwright/test";

/**
 * Regression coverage for the Branches guide's target-resolution reliability.
 *
 * Runs against the real dev server and real app code — every backend call is
 * intercepted at the network boundary and answered with the same fixture
 * shapes the Vitest/MSW suite uses. This is not an auth bypass: `core/auth`'s
 * real login flow, real token handling and real workspace resolution all run
 * unmodified; only what the fake backend origin returns is faked. That is
 * what makes this file able to run with **no live backend and no test
 * credentials**, unlike `academic-year-guide.spec.ts`.
 *
 * One long, sequential flow rather than several independent tests — running
 * the same assertions split across separate tests reintroduced timing
 * flakiness this single flow does not exhibit (each test would cold-start
 * its own sign-in against the same shared dev server); the trade-off is a
 * single failure point being less precise about which assertion broke, which
 * the step-by-step structure below is written to offset.
 *
 * This file exists because of a real, reported bug: on `/app/branches`, the
 * guide's first step highlighted the header's workspace switcher instead of
 * the real "New branch" control. Root-causing it live (via this same
 * network-mocked technique, iteratively) found and fixed five distinct
 * defects in `core/guides/guide-provider.tsx`, all covered below so none of
 * them can silently return:
 *
 * 1. Joyride scrolled a target to the literal top of the viewport, with no
 *    notion of `AppLayout`'s sticky header — a target near the top of a
 *    page's content ended up numerically "in the viewport" while actually
 *    rendered behind the header. Fixed with a dynamically-measured
 *    `scrollOffset` (`useStickyChromeClearance`).
 * 2. `run` was gated on `isOnCurrentStep`, so it flickered `true → false →
 *    true` on every cross-route step transition — and Joyride treats that
 *    flicker as "the tour ended," discarding the guide silently. Fixed by
 *    decoupling `run` from route-matching.
 * 3. Joyride's `scrollToFirstStep` defaults to `false`; since every logical
 *    step is reported to Joyride as its own internal index 0 (a single-slot
 *    controlled array), every step looked like "the first step," so it only
 *    ever scrolled once, never again. Fixed with `scrollToFirstStep` plus a
 *    step-aware `key` that forces a clean remount (and lifecycle reset) per
 *    logical step.
 * 4. ESC/the tooltip's X resolve to `controls.close()`, which does not
 *    reliably also fire `TOUR_END` once steps can arrive via a fresh mount —
 *    without a `TOUR_END`, `stop()` was never called and the dimmed overlay
 *    stayed mounted, blocking every click on the real page underneath it.
 *    Fixed by handling `STEP_AFTER`/`close` directly.
 * 5. The target-ring effect was gated only on `run`, which (after fixing #2)
 *    no longer implies the route/entity actually match — it could have rung
 *    the wrong record's same-selector element. Fixed by gating it on
 *    `isOnCurrentStep` too.
 */

const API_BASE = "http://localhost:3001/v1";

function makeAccessToken(claims: Record<string, unknown> = {}): string {
  const payload = {
    sub: "user-1",
    email: "admin@institution.edu",
    role: "SUPER_ADMIN",
    organizationId: "org-1",
    branchId: "branch-1",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

function envelope(data: unknown) {
  return { success: true, message: null, data, meta: null, error: null };
}

const identity = {
  user: {
    id: "user-1",
    fullName: "Amaan Sheikh",
    email: "admin@institution.edu",
    role: "SUPER_ADMIN",
  },
  permissions: ["students:read", "fees:read"],
  context: {
    organizationId: "org-1",
    branchId: "branch-1",
    academicYearId: "ay-2026",
  },
  availableOrganizations: [
    { id: "org-1", name: "Universal Educational Trust", code: "UET-2024" },
  ],
  availableBranches: [
    { id: "branch-1", name: "Downtown Campus", code: "DTC", organizationId: "org-1" },
  ],
  availableAcademicYears: [
    {
      id: "ay-2026",
      name: "AY 2026-2027",
      code: "2026-27",
      organizationId: "org-1",
      branchId: null,
    },
  ],
};

const existingBranch = {
  id: "branch-1",
  organizationId: "org-1",
  name: "Downtown Campus",
  code: "DTC",
  registrationNumber: "REG-001",
  institutionType: "SCHOOL",
  affiliationType: "BOARD",
  affiliationName: "CBSE",
  logoUrl: null,
  contactEmail: "downtown@horizon.edu",
  contactPhone: "9876543210",
  addressLine1: "1 Campus Road",
  addressLine2: null,
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  pincode: "400001",
  structureMode: "DEFAULT",
  isActive: true,
  isDeleted: false,
};

const newBranch = {
  ...existingBranch,
  id: "branch-new-1",
  name: "New Repro Branch",
  code: "nrb",
};

/** Wires the network mocks and drives the real login + workspace-confirm UI
 * (never a token/session bypass), landing the page on the app dashboard. */
async function signIn(page: Page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/auth/login") && method === "POST") {
      return route.fulfill({
        status: 201,
        json: envelope({ accessToken: makeAccessToken(), refreshToken: "refresh-token-1" }),
      });
    }
    if (url.endsWith("/auth/refresh") && method === "POST") {
      return route.fulfill({
        status: 201,
        json: envelope({ accessToken: makeAccessToken(), refreshToken: "refresh-token-2" }),
      });
    }
    if (url.endsWith("/auth/me") && method === "GET") {
      return route.fulfill({ status: 200, json: envelope(identity) });
    }
    if (url.endsWith("/branches") && method === "POST") {
      return route.fulfill({ status: 201, json: envelope(newBranch) });
    }
    if (url.endsWith("/branches/branch-new-1") && method === "GET") {
      return route.fulfill({ status: 200, json: envelope(newBranch) });
    }
    if (url.includes("/branches") && method === "GET") {
      return route.fulfill({ status: 200, json: envelope([existingBranch]) });
    }
    if (url.includes("/organizations") && method === "GET") {
      return route.fulfill({
        status: 200,
        json: envelope([
          { id: "org-1", name: "Universal Educational Trust", code: "UET-2024", status: "ACTIVE" },
        ]),
      });
    }
    if ((url.includes("/audit") || url.includes("/system-settings")) && method === "GET") {
      return route.fulfill({
        status: 200,
        json: envelope(url.includes("/system-settings") ? null : []),
      });
    }
    return route.fulfill({ status: 200, json: envelope(null) });
  });

  await page.goto("/login");
  await page.getByLabel("Institutional email").fill("admin@institution.edu");
  await page.getByLabel("Password", { exact: true }).fill("whatever-not-checked");
  // Without this, tokens live in memory only (core/auth's default) and any
  // hard navigation wipes the session.
  await page.getByLabel(/remember me/i).check();
  await page.getByRole("button", { name: "Sign in" }).click();

  const continueButton = page.getByRole("button", { name: "Continue" });
  const continueAppeared = await continueButton
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (continueAppeared) await continueButton.click();

  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/app$/, { timeout: 15_000 });
}

/** Waits for the real signal that the guide is actually stopped — not merely
 * that one tooltip's text disappeared (Joyride can render nothing for its
 * own internal reasons independent of our store's status; see defect #4). */
async function expectGuideFullyStopped(page: Page) {
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 3000 });
}

// Desktop only: navigation below uses the always-visible sidebar links.
// Below `md` the sidebar is an off-canvas drawer needing its own open/close
// interaction first — a real, separate responsive-nav flow this spec does
// not attempt; see docs/guides.md's target-reliability section for what
// mobile coverage this file does and does not claim.
test.skip(
  ({ isMobile }) => isMobile,
  "desktop-only: mobile nav requires opening the off-canvas sidebar first",
);

test("the Branches guide resolves every target correctly across the real flow", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Branches" }).first().click();
  await expect(page).toHaveURL(/\/app\/branches$/);

  // ---- Step 1: target must be unique, real, and not behind the header ----
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();
  const tooltip = page.getByRole("alertdialog");
  await expect(tooltip.getByText("Create your first branch")).toBeVisible({
    timeout: 8000,
  });
  await page.waitForTimeout(300); // let the spotlight cutout finish positioning

  const step1Check = await page.evaluate(() => {
    const matches = document.querySelectorAll(
      '[data-guide="branch-dashboard-create-link"]',
    );
    const el = matches[0];
    if (!el) return { matchCount: matches.length, resolvesToTarget: false, obscuredByHeader: false };
    const r = el.getBoundingClientRect();
    const atCenter = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      matchCount: matches.length,
      resolvesToTarget:
        atCenter?.closest("[data-guide]")?.getAttribute("data-guide") ===
        "branch-dashboard-create-link",
      obscuredByHeader: Boolean(atCenter?.closest("header")),
    };
  });
  expect(step1Check.matchCount).toBe(1);
  expect(step1Check.resolvesToTarget).toBe(true);
  expect(step1Check.obscuredByHeader).toBe(false);

  const newBranchLink = page.getByRole("link", { name: "New branch" });
  await expect(newBranchLink).toBeInViewport();
  await newBranchLink.click();
  await expect(page).toHaveURL(/\/app\/branches\/new$/);

  // ---- Step 2: target below the fold must auto-scroll into view ----
  await expect(tooltip.getByText("Save the new branch")).toBeVisible({
    timeout: 8000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-guide="branch-create-submit"]');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= window.innerHeight;
        }),
      { timeout: 5000 },
    )
    .toBe(true);

  // Real form, real validation, real mutation — the guide only observes.
  await page.getByLabel("Branch name").fill("New Repro Branch");
  await page.getByLabel("Code", { exact: true }).fill("nrb");
  await page.getByLabel("Contact email").fill("nrb@horizon.edu");
  await page.getByLabel("Contact phone").fill("9876543210");
  await page.getByLabel("Address line 1").fill("1 Repro Lane");
  await page.getByLabel("City").fill("Mumbai");
  await page.getByLabel("State").fill("Maharashtra");
  await page.getByLabel("Country").fill("India");
  await page.getByLabel("Postal code").fill("400001");
  await page.getByRole("button", { name: "Create branch" }).click();

  // ---- Step 3: cross-route target readiness after a real mutation ----
  await expect(page).toHaveURL(/\/app\/branches\/branch-new-1$/, { timeout: 10_000 });
  await expect(tooltip.getByText("Check its operating status")).toBeVisible({
    timeout: 15_000,
  });

  // ---- ESC stops the guide and restores full, real interaction ----
  await page.waitForTimeout(300); // let the tooltip's own mount settle
  await page.keyboard.press("Escape");
  await expectGuideFullyStopped(page);
  const overflowAfterEsc = await page.evaluate(
    () => getComputedStyle(document.body).overflow,
  );
  expect(overflowAfterEsc).not.toBe("hidden");
  const lifecycleLink = page.getByRole("link", { name: "Lifecycle" }).first();
  await expect(lifecycleLink).toBeEnabled();
  await lifecycleLink.click();
  await expect(page).toHaveURL(/\/lifecycle$/, { timeout: 5000 });

  // ---- Outside click also dismisses cleanly, on a fresh restart ----
  await page.getByRole("link", { name: "Branches" }).first().click();
  await expect(page).toHaveURL(/\/app\/branches$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  // Skipped earlier, never completed — "Start", not "Restart" (guide
  // completion is never marked on a skip).
  await page.getByRole("button", { name: /start guided tour/i }).click();
  await expect(tooltip.getByText("Create your first branch")).toBeVisible({
    timeout: 8000,
  });
  await page.waitForTimeout(300);
  await page.mouse.click(50, 500); // far from the spotlight, on the dimmed area
  await expectGuideFullyStopped(page);
  const orgsLink = page.getByRole("link", { name: "Organizations" });
  await expect(orgsLink).toBeVisible({ timeout: 5000 });
  await orgsLink.click();
  await expect(page).toHaveURL(/\/app\/organizations$/, { timeout: 5000 });
});
