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
    await page.getByRole("button", { name: "Sign in" }).click();

    // A role entitled to more than one organization/branch/academic-year
    // combination lands on workspace selection first; every other role goes
    // straight to the app. Continue is enabled even before a full selection
    // (see `workspace-selection-form.tsx`), so this only fires it when the
    // screen is actually showing.
    const continueButton = page.getByRole("button", { name: "Continue" });
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }

    await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 15_000 });

    await provide(page);
  },
});

export { expect } from "@playwright/test";
