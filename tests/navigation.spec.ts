import { test, expect } from '@playwright/test';
import { gotoAuthenticated } from './helpers/navigation';

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, '/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  // ── Route navigation ─────────────────────────────────────────

  const routes = [
    { name: 'Products', url: '/products', heading: /product management/i },
    { name: 'Users', url: '/users', heading: /user management/i },
    { name: 'Orders', url: '/orders', heading: /order management/i },
    { name: 'Expenses', url: '/expenses', heading: /expense management/i },
    { name: 'Settings', url: '/settings', heading: /settings/i },
    { name: 'Dashboard', url: '/', heading: /dashboard/i },
  ];

  for (const route of routes) {
    test(`should navigate to ${route.name} page`, async ({ page }) => {
      await page.getByRole('link', { name: route.name }).first().click();
      await page.waitForURL(route.url, { timeout: 15000 });
      await expect(page).toHaveURL(route.url);
      // Use main content area heading to avoid matching sidebar links
      await expect(page.locator('main h1, main h2, main h3').filter({ hasText: route.heading }).first()).toBeVisible({ timeout: 10000 });
    });
  }

  // ── Active link styling ───────────────────────────────────────

  test('should highlight the active navigation link', async ({ page }) => {
    // Navigate to Products
    await page.getByRole('link', { name: 'Products' }).first().click();
    await page.waitForURL('/products');

    const productsLink = page.getByRole('link', { name: 'Products' }).first();
    await expect(productsLink).toHaveClass(/bg-blue-100/);

    // Dashboard link should NOT be active
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' }).first();
    await expect(dashboardLink).not.toHaveClass(/bg-blue-100/);
  });

  // ── Sign out button ───────────────────────────────────────────

  test('should have a sign out button in the sidebar', async ({ page }) => {
    const signOutBtn = page.getByRole('button', { name: /sign out/i }).first();
    await expect(signOutBtn).toBeVisible();
    await expect(signOutBtn).toBeEnabled();
  });

  // ── Admin Panel title ─────────────────────────────────────────

  test('should show Admin Panel title in sidebar', async ({ page }) => {
    // Target desktop sidebar specifically
    const desktopSidebar = page.locator('.hidden.lg\\:fixed');
    await expect(desktopSidebar.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  });

  // ── Back-to-Dashboard from any page ───────────────────────────

  test('should navigate back to Dashboard from Products', async ({ page }) => {
    await page.getByRole('link', { name: 'Products' }).first().click();
    await page.waitForURL('/products');

    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    // Wait for the dashboard page to be loaded
    await expect(page).toHaveURL('/');
  });

  // ── URL direct access ─────────────────────────────────────────

  test('should load Products page via direct URL', async ({ page }) => {
    await gotoAuthenticated(page, '/products');
    await expect(page.getByRole('heading', { name: /product management/i })).toBeVisible({ timeout: 15000 });
  });

  test('should load Orders page via direct URL', async ({ page }) => {
    await gotoAuthenticated(page, '/orders');
    await expect(page.getByRole('heading', { name: /order management/i })).toBeVisible({ timeout: 15000 });
  });

  test('should load Settings page via direct URL', async ({ page }) => {
    await gotoAuthenticated(page, '/settings');
    // Use the main content heading, not the sidebar link
    await expect(page.locator('main').getByRole('heading', { name: /settings/i }).first()).toBeVisible({ timeout: 15000 });
  });
});
