import { expect, test as base, type Page } from "@playwright/test";

/**
 * Authenticated Playwright fixture.
 *
 * Drives the real `/login` UI as a user would — never a direct token
 * injection or any other bypass of `core/auth`/`features/auth` internals —
 * then, if the account resolves to more than one organization/branch/
 * academic-year combination, confirms the workspace selection screen the
 * same way. See `tests/e2e/README.md` for what this needs to actually run.
 */
export interface AuthFixtures {
  authenticatedPage: Page;
}

export const test = base.extend<AuthFixtures>({
  // Playwright's conventional third-argument name for this callback is
  // `use` — renamed to `provide` here purely to dodge eslint-plugin-react-
  // hooks, which pattern-matches any function named `use*` as a React hook
  // regardless of context. Functionally identical either way.
  authenticatedPage: async ({ page }, provide, testInfo) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;

    testInfo.skip(
      !email || !password,
      "E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not set — see tests/e2e/README.md.",
    );

    await page.goto("/login");
    await page.getByLabel("Institutional email").fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    // Without this, the access token lives in memory only (core/auth's
    // default for an unchecked "remember me") and does not survive a hard
    // navigation — including a spec's own `page.goto("/app/...")` right
    // after this fixture hands back `page`, which every guide spec built on
    // this fixture does as its first line. Checking it is also simply what
    // a real user leaving a browser open across the test would do.
    await page.getByLabel(/remember me/i).check();
    await page.getByRole("button", { name: "Sign in" }).click();

    // A role entitled to more than one organization/branch/academic-year
    // combination lands on workspace selection first; every other role goes
    // straight to the app. Continue is enabled even before a full selection
    // (see `workspace-selection-form.tsx`), so this only fires it when the
    // screen is actually showing.
    //
    // `isVisible()` alone does not wait — it is an immediate, one-shot DOM
    // check, not a polling assertion — so calling it right after the Sign in
    // click reliably raced the screen's own render and always resolved
    // `false` before this was changed to `waitFor`. Confirmed live: the
    // network-mocked reproduction in `branch-guide-target-reliability.spec.ts`
    // hit the exact same bug in an equivalent hand-rolled check before that
    // fix, landing on `/workspace` while this fixture believed sign-in had
    // gone straight to `/app`.
    const continueButton = page.getByRole("button", { name: "Continue" });
    const continueAppeared = await continueButton
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (continueAppeared) await continueButton.click();

    await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 15_000 });

    await provide(page);
  },
});

export { expect } from "@playwright/test";
