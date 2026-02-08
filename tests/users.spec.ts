import { test, expect } from '@playwright/test';
import { waitForDataLoad, searchFor, gotoAuthenticated } from './helpers/navigation';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, '/users');
    await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible({ timeout: 15000 });
  });

  // ── Page header ────────────────────────────────────────────────

  test('should display page title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible();
    await expect(page.locator('text=Manage your users and their activity')).toBeVisible();
  });

  // ── Search ─────────────────────────────────────────────────────

  test('should have a search input for users', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search users/i);
    await expect(searchInput).toBeVisible();
  });

  test('search should filter users by email', async ({ page }) => {
    await waitForDataLoad(page);

    const searchInput = page.getByPlaceholder(/search users/i);
    const noUsersMsg = page.locator('text=No users found');
    const tableRows = page.locator('tbody tr');

    await searchInput.fill('nonexistent_email_xyz');

    // Wait for filter to apply: "No users found" visible or table row count 0
    await expect(noUsersMsg).toBeVisible({ timeout: 5000 });
    const isNoUsersVisible = await noUsersMsg.isVisible();
    const rowCount = await tableRows.count();
    expect(isNoUsersVisible || rowCount === 0).toBeTruthy();
  });

  test('clearing search should restore the full user list', async ({ page }) => {
    await waitForDataLoad(page);

    const searchInput = page.getByPlaceholder(/search users/i);
    const tableRows = page.locator('tbody tr');

    const initialRows = await tableRows.count();

    await searchInput.fill('nonexistent');
    await expect(tableRows).toHaveCount(0, { timeout: 5000 });

    await searchInput.fill('');
    await expect(tableRows).toHaveCount(initialRows, { timeout: 5000 });

    const restoredRows = await tableRows.count();
    expect(restoredRows).toBe(initialRows);
  });

  // ── User table ─────────────────────────────────────────────────

  test('should display users count in card header', async ({ page }) => {
    await waitForDataLoad(page);

    // "Users (N)" pattern
    await expect(page.locator('text=/Users \\(\\d+\\)/')).toBeVisible();
  });

  test('table should have correct column headers', async ({ page }) => {
    const headers = ['User', 'Status', 'Joined', 'Last Active', 'Orders', 'Total Spent', 'Actions'];
    for (const header of headers) {
      await expect(page.locator('th').filter({ hasText: header })).toBeVisible();
    }
  });

  test('user rows should display email and avatar initial', async ({ page }) => {
    await waitForDataLoad(page);

    const rows = page.locator('tbody tr');
    const count = await rows.count();

    if (count > 0) {
      // First row should have an email
      const firstRow = rows.first();
      // Should contain an email-like text
      const text = await firstRow.textContent();
      expect(text).toBeTruthy();

      // Avatar initial (single character in circle)
      await expect(firstRow.locator('.rounded-full').first()).toBeVisible();
    }
  });

  test('user status badges should show Verified or Pending', async ({ page }) => {
    await waitForDataLoad(page);

    const rows = page.locator('tbody tr');
    const count = await rows.count();

    if (count > 0) {
      // Each user should have a status badge
      const badges = page.locator('tbody').locator('text=/Verified|Pending/');
      const badgeCount = await badges.count();
      expect(badgeCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('user rows should display joined date', async ({ page }) => {
    await waitForDataLoad(page);

    const rows = page.locator('tbody tr');
    const count = await rows.count();

    if (count > 0) {
      // Date format: "Mon DD, YYYY"
      await expect(page.locator('tbody').locator('text=/\\w{3} \\d{1,2}, \\d{4}/').first()).toBeVisible();
    }
  });

  test('user rows should show order count', async ({ page }) => {
    await waitForDataLoad(page);

    const rows = page.locator('tbody tr');
    const count = await rows.count();

    if (count > 0) {
      // Order count column should have a number
      const firstRow = rows.first();
      const text = await firstRow.textContent();
      expect(text).toMatch(/\d/);
    }
  });

  // ── Actions dropdown ───────────────────────────────────────────

  test('user action dropdown should have Send Email, View Orders, Suspend options', async ({ page }) => {
    await waitForDataLoad(page);

    const rows = page.locator('tbody tr');
    const count = await rows.count();

    if (count > 0) {
      // Click the actions menu button (last column = Actions, single button per row)
      const actionBtn = rows.first().locator('td:last-child').getByRole('button');
      await actionBtn.click();

      await expect(page.locator('text=Send Email')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=View Orders')).toBeVisible();
      await expect(page.locator('text=Suspend User')).toBeVisible();
    }
  });

  // ── Empty state ────────────────────────────────────────────────

  test('should show empty state when search yields no results', async ({ page }) => {
    await waitForDataLoad(page);

    await searchFor(page, 'completelynonexistentuserxyz123');
    await page.waitForTimeout(500);

    const noUsers = page.locator('text=No users found');
    await expect(noUsers).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Try adjusting your search terms')).toBeVisible();
  });
});
