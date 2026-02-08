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
    await expect(page.getByRole('heading', { name: 'Admin Panel' }).first()).toBeVisible({ timeout: 15000 });
  });

  // ── Mobile header ──────────────────────────────────────────────

  test('should show mobile hamburger menu on small screen', async ({ page }) => {
    // On mobile, the mobile header (lg:hidden) should show "Admin Panel"
    // The mobile header is inside .lg\:pl-64 > .lg\:hidden
    await expect(page.getByRole('heading', { name: 'Admin Panel' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('should have a hamburger menu button on mobile', async ({ page }) => {
    const mobileHeader = page.locator('[data-testid="mobile-header"]');
    const menuBtn = mobileHeader.getByRole('button').first();
    await expect(menuBtn).toBeVisible({ timeout: 10000 });
  });

  // ── Mobile sidebar ─────────────────────────────────────────────

  test('clicking hamburger should open mobile sidebar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Admin Panel' }).first()).toBeVisible({ timeout: 15000 });

    const mobileHeader = page.locator('[data-testid="mobile-header"]');
    const menuBtn = mobileHeader.getByRole('button').first();
    await menuBtn.click();

    // Mobile sidebar navigation items should become visible
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink.first()).toBeVisible({ timeout: 5000 });
    const count = await dashboardLink.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Mobile navigation ──────────────────────────────────────────

  test('should be able to navigate on mobile viewport', async ({ page }) => {
    await gotoAuthenticated(page, '/products');
    await expect(page.getByRole('heading', { name: 'Product Management' })).toBeVisible({ timeout: 15000 });
    // Product content: either the product list (when products exist) or the empty state
    const productList = page.locator('[data-testid="product-list"]');
    const emptyState = page.getByRole('heading', { name: 'No products found' });
    await expect(productList.or(emptyState)).toBeVisible({ timeout: 15000 });
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
    await expect(page.getByRole('heading', { name: 'Product Management' })).toBeVisible({ timeout: 15000 });

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });
});
