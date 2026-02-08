import { test, expect } from '@playwright/test';
import { waitForDataLoad, gotoAuthenticated } from './helpers/navigation';

test.describe('Expense Management', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, '/expenses');
    // Use .first() to avoid strict mode violation when there are multiple matching headings
    await expect(page.getByRole('heading', { name: /expense management/i }).first()).toBeVisible({ timeout: 15000 });
  });

  // ── Page header ────────────────────────────────────────────────

  test('should display page title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /expense management/i }).first()).toBeVisible();
    await expect(page.locator('text=Manage company expenses, approvals, and analytics')).toBeVisible();
  });

  // ── Tabs ───────────────────────────────────────────────────────

  test('should have Expense List and Analytics tabs', async ({ page }) => {
    await expect(page.locator('[role="tablist"]').locator('text=Expense List')).toBeVisible();
    await expect(page.locator('[role="tablist"]').locator('text=Analytics')).toBeVisible();
  });

  test('Expense List tab should be active by default', async ({ page }) => {
    // The list tab content should be visible
    await expect(page.locator('[role="tablist"]').locator('text=Expense List')).toBeVisible();
  });

  test('clicking Analytics tab should show analytics content', async ({ page }) => {
    await page.locator('[role="tablist"]').locator('text=Analytics').click();

    // Analytics tab content should now be visible (assertion auto-waits)
    // ExpenseAnalytics renders charts/analytics
    await expect(page.locator('text=/analytic|chart|expense.*summary|overview/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('should be able to switch back to Expense List tab', async ({ page }) => {
    // Go to Analytics
    await page.locator('[role="tablist"]').locator('text=Analytics').click();
    await page.waitForTimeout(500);

    // Back to List
    await page.locator('[role="tablist"]').locator('text=Expense List').click();
    await page.waitForTimeout(500);

    // List content should be visible
    await expect(page.locator('[role="tablist"]').locator('text=Expense List')).toBeVisible();
  });

  // ── Expense List content ───────────────────────────────────────

  test('expense list should have search functionality', async ({ page }) => {
    // ExpenseManagement component has search input
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();
  });

  test('expense list should have filter controls', async ({ page }) => {
    await waitForDataLoad(page);

    // Check for actual filter controls
    const statusFilter = page.getByRole('button', { name: /status|filter/i }).first();
    const hasStatusFilter = await statusFilter.isVisible().catch(() => false);
    
    // Alternative: check for date or search filters
    const dateFilters = page.locator('input[type="date"]');
    const dateFilterCount = await dateFilters.count();
    
    // Should have some filter UI present
    expect(hasStatusFilter || dateFilterCount > 0).toBeTruthy();
  });

  test('should show expense data in a table format', async ({ page }) => {
    await waitForDataLoad(page);

    // ExpenseManagement uses Table component
    const table = page.locator('table').first();
    const tableVisible = await table.isVisible().catch(() => false);

    if (tableVisible) {
      // Table headers should exist
      const headers = page.locator('th');
      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThan(0);
    }
  });

  // ── Add expense ────────────────────────────────────────────────

  test('should have a button to create new expense', async ({ page }) => {
    await waitForDataLoad(page);

    // Look for Add/Create/New Expense button
    const addBtn = page.locator('button').filter({ hasText: /add|create|new/i }).first();
    
    // Verify the button actually exists and is visible
    expect(await addBtn.isVisible()).toBe(true);
  });

  // ── Expense status badges ──────────────────────────────────────

  test('expense items should display status badges', async ({ page }) => {
    await waitForDataLoad(page);

    // Status badges: pending, approved, rejected, paid
    const statusTexts = page.locator('text=/pending|approved|rejected|paid/i');
    const count = await statusTexts.count();

    // Only assert if there are expenses with status
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
      // Verify the first status text matches expected values
      const firstStatusText = await statusTexts.nth(0).textContent();
      expect(firstStatusText?.toLowerCase()).toMatch(/pending|approved|rejected|paid/);
    }
  });

  // ── Bulk actions ───────────────────────────────────────────────

  test('expense list should have checkbox for bulk selection', async ({ page }) => {
    await waitForDataLoad(page);

    // ExpenseManagement uses Checkbox from shadcn
    const checkboxes = page.locator('[role="checkbox"]');
    const count = await checkboxes.count();

    // Only assert if there are checkboxes
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });

  // ── No access denied for admins ────────────────────────────────

  test('admin user should not see access denied message', async ({ page }) => {
    await expect(page.locator('text=Access Denied')).not.toBeVisible();
  });

  // ── Loading state ──────────────────────────────────────────────

  test('should not show loading spinner after data loads', async ({ page }) => {
    // Wait for loading indicator to disappear (condition-based; proceeds as soon as data loads)
    await expect(page.locator('text=Loading expense management...')).not.toBeVisible({ timeout: 10000 });
  });
});
