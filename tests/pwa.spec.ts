import { test, expect } from "@playwright/test";

test.describe("PWA install banner", () => {
  test("login page does not show install banner", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("pwa-install-banner")).toHaveCount(0);
  });

  test("document references manifest", async ({ page }) => {
    await page.goto("/login");
    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    expect(manifestHref).toBeTruthy();
  });
});
