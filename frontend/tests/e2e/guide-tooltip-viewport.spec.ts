import { expect, test, type Page } from "@playwright/test";

/**
 * Regression coverage for the guide platform's tooltip *viewport*
 * positioning — as opposed to `branch-guide-target-reliability.spec.ts` and
 * `academic-structure-guide-reliability.spec.ts`, which cover *target*
 * resolution (finding and scrolling to the right element). This file exists
 * because of a real, reported bug, reproduced live before any fix: on
 * `/app/academic-units/new`, the guide's create-submit tooltip rendered
 * mostly above the viewport (`boundingBox().y: -344` at 1280×720) — the
 * target became visible and scrolled correctly, but the *tooltip* did not
 * account for the safe viewport at all.
 *
 * Root cause: that step's target is the whole `<form>` (deliberately — see
 * "Guide target reliability" — so the overlay never blocks a required field
 * elsewhere in the form), and a target that much taller than the viewport
 * defeats Floating UI's own `flip`/`shift` placement math on its own: `flip`
 * only picks whichever placement overflows *least*, which can still
 * overflow. `core/guides/tooltip-viewport.ts` is the shared-platform fix —
 * every step gets both a safe-area-aware `flip`/`shift` padding (so the
 * *preferred* placement already respects the sticky header) and an
 * unconditional final clamp middleware (so it's guaranteed regardless). See
 * that file's own header comments and `docs/guides.md` "Tooltip Positioning
 * Contract" for the full reasoning; `tests/unit/tooltip-viewport.test.ts`
 * covers the positioning math itself without a browser. This file is the
 * browser-level proof: the real tooltip, in the real app, never clips.
 *
 * Same network-mocked technique as the other two reliability specs — no
 * live backend or test credentials needed. Not an auth bypass: only the
 * mocked backend origin's responses are faked; `core/auth`'s real login UI,
 * token handling and workspace resolution all run unmodified.
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
  context: { organizationId: "org-1", branchId: "branch-1", academicYearId: "ay-2026" },
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

const newProgram = {
  id: "program-new-1",
  branchId: "branch-1",
  name: "Higher Secondary Science",
  level: "SCHOOL",
  medium: "English",
  stream: "Science (PCM)",
  parentId: null,
  isActive: true,
};

async function signIn(page: Page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/auth/login") && method === "POST")
      return route.fulfill({
        status: 201,
        json: envelope({ accessToken: makeAccessToken(), refreshToken: "refresh-token-1" }),
      });
    if (url.endsWith("/auth/refresh") && method === "POST")
      return route.fulfill({
        status: 201,
        json: envelope({ accessToken: makeAccessToken(), refreshToken: "refresh-token-2" }),
      });
    if (url.endsWith("/auth/me") && method === "GET")
      return route.fulfill({ status: 200, json: envelope(identity) });
    if (url.includes("/programs") && method === "GET")
      return route.fulfill({ status: 200, json: envelope([newProgram]) });
    if (url.includes("/academic-units") && method === "GET")
      return route.fulfill({ status: 200, json: envelope([]) });
    if (url.includes("/academic-years") && method === "GET")
      return route.fulfill({ status: 200, json: envelope([]) });
    if (url.includes("/organizations") && method === "GET")
      return route.fulfill({
        status: 200,
        json: envelope([
          { id: "org-1", name: "Universal Educational Trust", code: "UET-2024", status: "ACTIVE" },
        ]),
      });
    if (url.includes("/branches") && method === "GET")
      return route.fulfill({
        status: 200,
        json: envelope([
          {
            id: "branch-1",
            organizationId: "org-1",
            name: "Downtown Campus",
            code: "DTC",
            isActive: true,
            isDeleted: false,
          },
        ]),
      });
    if ((url.includes("/audit") || url.includes("/system-settings")) && method === "GET")
      return route.fulfill({
        status: 200,
        json: envelope(url.includes("/system-settings") ? null : []),
      });
    return route.fulfill({ status: 200, json: envelope(null) });
  });

  await page.goto("/login");
  await page.getByLabel("Institutional email").fill("admin@institution.edu");
  await page.getByLabel("Password", { exact: true }).fill("whatever-not-checked");
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

/** The hard acceptance rule itself (docs/guides.md "Tooltip Positioning
 * Contract"): every side of the rendered tooltip inside the viewport. A
 * 1px allowance absorbs subpixel rounding, never a real clip. */
function assertFullyInViewport(
  box: { x: number; y: number; width: number; height: number } | null,
  viewport: { width: number; height: number } | null,
) {
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  const b = box!;
  const v = viewport!;
  expect(b.x, "tooltip left edge clipped").toBeGreaterThanOrEqual(-1);
  expect(b.y, "tooltip top edge clipped").toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width, "tooltip right edge clipped").toBeLessThanOrEqual(v.width + 1);
  expect(b.y + b.height, "tooltip bottom edge clipped").toBeLessThanOrEqual(v.height + 1);
}

test.skip(
  ({ isMobile }) => isMobile,
  "desktop-only: mobile nav requires opening the off-canvas sidebar first; covered instead by the live-resize case below, which starts from the desktop nav.",
);

test("the exact reported bug: Academic Unit create-submit tooltip is fully visible, not clipped above the viewport", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Academic Units" }).first().click();
  await expect(page).toHaveURL(/\/app\/academic-units$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();
  await page.getByRole("link", { name: "New unit", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/academic-units\/new$/, { timeout: 8000 });

  const tooltip = page.getByRole("alertdialog");
  await expect(tooltip.getByText("Save the new unit")).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);

  const box = await tooltip.boundingBox();
  // The specific, previously-reported failure mode, named directly: before
  // the fix this was -344 at 1280x720.
  expect(box!.y, "tooltip rendered above the viewport (the reported bug)").toBeGreaterThanOrEqual(0);
  assertFullyInViewport(box, page.viewportSize());

  // The tooltip's own title and the Skip control must both actually be
  // readable/reachable — not just "the container's box happens to overlap
  // the viewport."
  await expect(tooltip.getByText("Save the new unit")).toBeInViewport();
  await expect(tooltip.getByRole("button", { name: /skip guide/i })).toBeInViewport();
});

test("the same tooltip stays fully visible across a live resize down to a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signIn(page);
  await page.getByRole("link", { name: "Academic Units" }).first().click();
  await expect(page).toHaveURL(/\/app\/academic-units$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();
  await page.getByRole("link", { name: "New unit", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/academic-units\/new$/, { timeout: 8000 });

  const tooltip = page.getByRole("alertdialog");
  await expect(tooltip.getByText("Save the new unit")).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);
  assertFullyInViewport(await tooltip.boundingBox(), page.viewportSize());

  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    // No magic-number wait for "the fix": this is the ResizeObserver-driven
    // `useStickyChromeClearance` measurement and Floating UI's own
    // `autoUpdate` resize listener settling, not a workaround for a race.
    await page.waitForTimeout(400);
    assertFullyInViewport(await tooltip.boundingBox(), page.viewportSize());
  }
});

test("Program create-submit tooltip (the same whole-form target shape) is fully visible", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Programs" }).first().click();
  await expect(page).toHaveURL(/\/app\/programs$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();
  await page.getByRole("link", { name: "New program", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/programs\/new$/, { timeout: 8000 });

  const tooltip = page.getByRole("alertdialog");
  await expect(tooltip.getByText("Save the new program")).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);
  assertFullyInViewport(await tooltip.boundingBox(), page.viewportSize());
});

test("no regression: Branches, Academic Years and Organizations dashboard tooltips stay fully visible", async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole("link", { name: "Branches" }).first().click();
  await expect(page).toHaveURL(/\/app\/branches$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();
  const tooltip = page.getByRole("alertdialog");
  await expect(tooltip).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(300);
  assertFullyInViewport(await tooltip.boundingBox(), page.viewportSize());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 3000 });

  await page.getByRole("link", { name: "Academic Years" }).first().click();
  await expect(page).toHaveURL(/\/app\/academic-years$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();
  await expect(tooltip).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(300);
  assertFullyInViewport(await tooltip.boundingBox(), page.viewportSize());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 3000 });

  await page.getByRole("link", { name: "Organizations" }).first().click();
  await expect(page).toHaveURL(/\/app\/organizations$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();
  await expect(tooltip).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(300);
  assertFullyInViewport(await tooltip.boundingBox(), page.viewportSize());
});
