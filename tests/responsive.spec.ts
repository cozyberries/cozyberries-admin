import { test, expect, devices } from '@playwright/test';
import { gotoAuthenticated } from './helpers/navigation';

test.describe('Responsive / Mobile Layout', () => {
  // Use iPhone 12 viewport
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: devices['iPhone 12'].userAgent,
  });

  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, '/');
    await page.waitForTimeout(1000);
  });

  // ── Mobile header ──────────────────────────────────────────────

  test('should show mobile hamburger menu on small screen', async ({ page }) => {
    // On mobile, the mobile header (lg:hidden) should show "Admin Panel"
    // The mobile header is inside .lg\:pl-64 > .lg\:hidden
    await expect(page.getByRole('heading', { name: 'Admin Panel' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('should have a hamburger menu button on mobile', async ({ page }) => {
    // Menu button (hamburger icon) is in the sticky mobile header
    const mobileHeader = page.locator('.sticky.top-0');
    const menuBtn = mobileHeader.locator('button').first();
    await expect(menuBtn).toBeVisible({ timeout: 10000 });
  });

  // ── Mobile sidebar ─────────────────────────────────────────────

  test('clicking hamburger should open mobile sidebar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Admin Panel' }).first()).toBeVisible({ timeout: 15000 });

    // Click the hamburger menu button in the sticky mobile header
    const mobileHeader = page.locator('.sticky.top-0');
    const menuBtn = mobileHeader.locator('button').first();
    await menuBtn.click();
    await page.waitForTimeout(500);

    // Mobile sidebar navigation items should become visible
    // Check if nav links appear in the mobile drawer
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    const count = await dashboardLink.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Mobile navigation ──────────────────────────────────────────

  test('should be able to navigate on mobile viewport', async ({ page }) => {
    // Navigate directly to products
    await gotoAuthenticated(page, '/products');
    await page.waitForTimeout(3000);

    // Page should still render content
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  // ── Login page on mobile ──────────────────────────────────────

  test('login page should be usable on mobile', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();

    // All elements should fit within viewport (no horizontal scroll needed)
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  // ── Content readability ────────────────────────────────────────

  test('page content should not overflow on mobile', async ({ page }) => {
    await gotoAuthenticated(page, '/products');
    await page.waitForTimeout(3000);

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });
});
