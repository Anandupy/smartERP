import { expect, test } from "@playwright/test";

test.describe("application shell", () => {
  test("home page renders the platform landing", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /platform ready/i }),
    ).toBeVisible();
  });

  test("unknown routes render the 404 page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
  });
});
