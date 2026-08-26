import { expect, test } from "./fixtures/auth";

/**
 * The Academic Years guide, exercised end to end against a real backend.
 *
 * Requires `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (see `tests/e2e/README.md`)
 * — skips itself otherwise, same as the fixture it's built on. Runs against
 * the `chromium` project only: the guide's mobile presentation is out of
 * scope for this reference implementation (see `docs/guides.md`).
 *
 * This performs a real, irreversible activation (the API documents no
 * deactivate) and creates a real academic year — repeat runs accumulate
 * records against whatever branch the test account resolves to. That's a
 * deliberate, documented cost of a true end-to-end guide test, not an
 * oversight; see `tests/e2e/README.md`.
 */
test.describe("Academic Years guide", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Guide e2e coverage runs on chromium only.",
  );

  test("create → success → guide continues on Details → activate → completes", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/app/academic-years");
    await expect(
      page.getByRole("heading", { name: "Academic Years" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Help for this page" }).click();
    await page.getByRole("button", { name: /start guided tour/i }).click();

    // Step 1: the dashboard's real "New academic year" link is the target —
    // no synthetic "Next" button stands in for it.
    await expect(
      page.getByText("Create your first academic year"),
    ).toBeVisible();
    await page
      .getByRole("link", { name: /new academic year/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/academic-years\/new$/);

    // Step 2: fill and submit the real form.
    await expect(page.getByText("Save the new year")).toBeVisible();
    const uniqueName = `E2E Guide ${Date.now()}`;
    await page.getByLabel(/^name$/i).fill(uniqueName);
    await page.getByLabel(/start date/i).fill("2031-04-01");
    await page.getByLabel(/end date/i).fill("2032-03-31");
    await page.getByRole("button", { name: /create academic year/i }).click();

    // Existing, untouched success behavior: a toast, and a redirect to the
    // new year's Details screen — never the Lifecycle screen (see
    // `docs/academic-year-module.md`).
    await expect(page.getByText(`${uniqueName} created`)).toBeVisible();
    await expect(page).toHaveURL(/\/app\/academic-years\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: uniqueName, level: 1 }),
    ).toBeVisible();

    // Step 3: the guide continues on this page, pointing at the real
    // Lifecycle link — not a forced redirect.
    await expect(page.getByText("Now activate it")).toBeVisible();
    await page.getByRole("link", { name: /lifecycle/i }).click();
    await expect(page).toHaveURL(/\/lifecycle$/);

    // Step 4: activate, through the real confirmation dialog.
    await expect(page.getByText("Activate the year")).toBeVisible();
    await page.getByRole("button", { name: "Activate year" }).click();
    await page
      .getByRole("alertdialog", { name: /activate year\?/i })
      .getByRole("button", { name: "Activate year" })
      .click();
    await expect(page.getByText("Academic year activated")).toBeVisible();

    // The guide completes — its tooltip is gone — and does not replay on
    // reload, proving persistence works through a real page load.
    await expect(page.getByText("Activate the year")).toBeHidden();
    await page.reload();
    await expect(page.getByText("Activate the year")).toBeHidden();
  });
});
