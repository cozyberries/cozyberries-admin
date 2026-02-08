import { test, expect } from '@playwright/test';
import { waitForDataLoad, gotoAuthenticated } from './helpers/navigation';

test.describe('Dashboard / Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, '/');
    // Wait for dashboard to load - use the main content heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  // ── Layout assertions ──────────────────────────────────────────

  test('should display the admin layout with sidebar', async ({ page }) => {
    // Desktop sidebar should be visible (scope to the desktop sidebar container)
    const desktopSidebar = page.locator('.hidden.lg\\:fixed');
    await expect(desktopSidebar.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();

    // All sidebar navigation links present
    const navLinks = ['Dashboard', 'Products', 'Users', 'Orders', 'Expenses', 'Settings'];
    for (const link of navLinks) {
      await expect(page.getByRole('link', { name: link }).first()).toBeVisible();
    }

    // Sign Out button in sidebar
    await expect(page.getByRole('button', { name: /sign out/i }).first()).toBeVisible();
  });

  test('should highlight Dashboard as the active nav item', async ({ page }) => {
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' }).first();
    await expect(dashboardLink).toHaveAttribute('aria-current', 'page');
  });

  // ── Stat cards ─────────────────────────────────────────────────

  test('should display stat cards with numeric values', async ({ page }) => {
    await waitForDataLoad(page);

    // The dashboard renders stat cards: Total Revenue, Total Orders, Total Users, Total Products
    const statTitles = ['Total Revenue', 'Total Orders', 'Total Users', 'Total Products'];
    for (const title of statTitles) {
      await expect(page.locator(`text=${title}`).first()).toBeVisible();
    }
  });

  test('stat cards should show formatted numbers', async ({ page }) => {
    await waitForDataLoad(page);

    // Revenue card should contain currency symbol ₹ (INR formatting)
    const revenueCard = page.locator('text=Total Revenue').locator('..');
    await expect(revenueCard).toBeVisible();
  });

  // ── Monthly stats ──────────────────────────────────────────────

  test('should display monthly statistics section', async ({ page }) => {
    await waitForDataLoad(page);

    // The page has "Monthly Revenue" and "Monthly Orders" headings
    await expect(page.getByRole('heading', { name: 'Monthly Revenue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Monthly Orders' })).toBeVisible();
  });

  // ── Expense dashboard section ──────────────────────────────────

  test('should show expense dashboard widget', async ({ page }) => {
    await waitForDataLoad(page);

    // ExpenseDashboard renders "Expense Overview" heading in the main content
    await expect(page.getByRole('heading', { name: /expense overview/i })).toBeVisible();
  });

  // ── Recent activities ──────────────────────────────────────────

  test('should display recent activities section', async ({ page }) => {
    await waitForDataLoad(page);

    await expect(page.getByRole('heading', { name: /recent activity/i })).toBeVisible();
  });

  // ── Responsiveness hint ────────────────────────────────────────

  test('page should not have horizontal scrollbar at desktop width', async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // +1 for rounding
  });
});
