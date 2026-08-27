import { expect, test, type Page } from "@playwright/test";

/**
 * Regression coverage for the Programs and Academic Units guides — the
 * second real-world journey built on the same network-mocked technique as
 * `branch-guide-target-reliability.spec.ts` (see that file for why this
 * needs no live backend or test credentials, and what it is not: an auth
 * bypass — only the mocked backend origin's responses are faked).
 *
 * Exercises the real dependency order confirmed in `docs/program-module.md`
 * and `docs/academic-unit-module.md`: an academic unit's request body names
 * a `programId`, so a program must exist before a unit can be created under
 * it — Programs, then Academic Units, not the reverse.
 *
 * Also the regression that led to moving each guide's create-submit target
 * from the submit button to the surrounding `<form>` (see both guide
 * definitions): Joyride's dimmed overlay blocks pointer events on
 * everything outside its spotlight cutout, so a target narrower than every
 * field the step's real workflow needs — the Academic Unit form's required
 * Program picker, in particular — trapped a real interaction, not just this
 * test's. See docs/guides.md "Guide target reliability."
 *
 * Known flake (~1 in 8-10 runs, not eliminated): occasionally, clicking a
 * nav link in the instant right after a guide completes via its last
 * step's Next button leaves a full-page, no-cutout Joyride overlay
 * blocking that click. Confirmed it is not the STEP_AFTER/close gap fixed
 * in guide-provider.tsx (this is the STEP_AFTER/NEXT path, and the
 * alertdialog-count-zero check — the real signal, not just one tooltip's
 * text — passes before it happens). Did not reproduce it with console
 * diagnostics attached, so its exact cause is still open. It requires an
 * artificial zero-delay pattern no real user interaction produces; the
 * `waitForTimeout(300)` before the next click measurably reduces but does
 * not eliminate it. Left as a documented, known residual rather than
 * chased further with unprincipled timing changes.
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

const newUnit = {
  id: "unit-new-1",
  branchId: "branch-1",
  programId: "program-new-1",
  academicYearId: "ay-2026",
  parentId: null,
  name: "Std 1",
  code: null,
  unitType: "CLASS",
  displayOrder: null,
  isActive: true,
  metadata: null,
  level: 0,
};

async function signIn(page: Page) {
  let programs: unknown[] = [];
  const units: unknown[] = [];

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
    if (url.endsWith("/programs") && method === "POST") {
      programs = [newProgram];
      return route.fulfill({ status: 201, json: envelope(newProgram) });
    }
    if (url.endsWith(`/programs/${newProgram.id}`) && method === "GET") {
      return route.fulfill({ status: 200, json: envelope(newProgram) });
    }
    if (url.includes("/programs") && method === "GET") {
      return route.fulfill({ status: 200, json: envelope(programs) });
    }
    if (url.endsWith("/academic-units") && method === "POST") {
      units.push(newUnit);
      return route.fulfill({ status: 201, json: envelope(newUnit) });
    }
    if (url.endsWith(`/academic-units/${newUnit.id}`) && method === "GET") {
      return route.fulfill({ status: 200, json: envelope(newUnit) });
    }
    if (url.includes("/academic-units") && method === "GET") {
      return route.fulfill({ status: 200, json: envelope(units) });
    }
    if (url.includes("/organizations") && method === "GET") {
      return route.fulfill({
        status: 200,
        json: envelope([
          { id: "org-1", name: "Universal Educational Trust", code: "UET-2024", status: "ACTIVE" },
        ]),
      });
    }
    if (url.includes("/branches") && method === "GET") {
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

test.skip(
  ({ isMobile }) => isMobile,
  "desktop-only: mobile nav requires opening the off-canvas sidebar first",
);

test("the Program then Academic Unit guides resolve every target correctly, in the real dependency order", async ({
  page,
}) => {
  await signIn(page);

  // ---- Programs: step 1, real target, not obscured by the header ----
  await page.getByRole("link", { name: "Programs" }).first().click();
  await expect(page).toHaveURL(/\/app\/programs$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();

  const tooltip = page.getByRole("alertdialog");
  await expect(tooltip.getByText("Create your first program")).toBeVisible({
    timeout: 8000,
  });
  await page.waitForTimeout(300);

  const step1Check = await page.evaluate(() => {
    const matches = document.querySelectorAll(
      '[data-guide="program-dashboard-create-link"]',
    );
    const el = matches[0];
    if (!el) return { matchCount: matches.length, resolvesToTarget: false };
    const r = el.getBoundingClientRect();
    const atCenter = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      matchCount: matches.length,
      resolvesToTarget:
        atCenter?.closest("[data-guide]")?.getAttribute("data-guide") ===
        "program-dashboard-create-link",
      obscuredByHeader: Boolean(atCenter?.closest("header")),
    };
  });
  expect(step1Check.matchCount).toBe(1);
  expect(step1Check.resolvesToTarget).toBe(true);
  expect(step1Check.obscuredByHeader).toBe(false);

  await page
    .getByRole("link", { name: "New program", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/programs\/new$/, { timeout: 8000 });

  // ---- Programs: step 2, real form, real mutation ----
  await expect(tooltip.getByText("Save the new program")).toBeVisible({
    timeout: 8000,
  });
  await page.waitForTimeout(500); // let the auto-scroll to the submit button settle
  const nameField = page.getByLabel("Program name");
  await nameField.fill("Higher Secondary Science");
  await expect(nameField).toHaveValue("Higher Secondary Science");
  await page.getByRole("button", { name: "Create program" }).click();

  // ---- Programs: step 3, cross-route, explanatory ----
  await expect(page).toHaveURL(/\/app\/programs\/program-new-1$/, {
    timeout: 10_000,
  });
  await expect(
    tooltip.getByText("Now build the structure inside it"),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^next$/i }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 3000 });
  await page.waitForTimeout(300); // let the completed guide's teardown settle

  // ---- Academic Units: step 1, real target ----
  await page.getByRole("link", { name: "Academic Units" }).first().click();
  await expect(page).toHaveURL(/\/app\/academic-units$/);
  await page.getByRole("button", { name: /guide for this page/i }).click();
  await page.getByRole("button", { name: /start guided tour/i }).click();

  await expect(
    tooltip.getByText("Create your first academic unit"),
  ).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(300);

  const step1UnitCheck = await page.evaluate(() => {
    const matches = document.querySelectorAll(
      '[data-guide="academic-unit-dashboard-create-link"]',
    );
    const el = matches[0];
    if (!el) return { matchCount: matches.length, obscuredByHeader: false };
    const r = el.getBoundingClientRect();
    const atCenter = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      matchCount: matches.length,
      obscuredByHeader: Boolean(atCenter?.closest("header")),
    };
  });
  expect(step1UnitCheck.matchCount).toBe(1);
  expect(step1UnitCheck.obscuredByHeader).toBe(false);

  await page.getByRole("link", { name: "New unit", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/academic-units\/new$/, {
    timeout: 8000,
  });

  // ---- Academic Units: step 2, real form (incl. the cross-feature
  // ProgramPicker slot) and a real mutation ----
  await expect(tooltip.getByText("Save the new unit")).toBeVisible({
    timeout: 8000,
  });
  await page.waitForTimeout(500); // let the auto-scroll to the submit button settle
  const unitNameField = page.getByLabel(/^name$/i);
  await unitNameField.fill("Std 1");
  await expect(unitNameField).toHaveValue("Std 1");
  await page.getByRole("combobox", { name: "Program" }).click();
  await page.getByRole("option", { name: /higher secondary science/i }).click();
  await expect(unitNameField).toHaveValue("Std 1");
  await page.getByRole("button", { name: "Create unit" }).click();

  // ---- Academic Units: step 3, cross-route, explanatory ----
  await expect(page).toHaveURL(/\/app\/academic-units\/unit-new-1$/, {
    timeout: 10_000,
  });
  await expect(
    tooltip.getByText("That's the structure started"),
  ).toBeVisible({ timeout: 15_000 });

  // ---- ESC fully stops the guide and restores real interaction ----
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0, { timeout: 3000 });
  const moveButton = page.getByRole("button", { name: "Move" });
  await expect(moveButton).toBeEnabled();
});
