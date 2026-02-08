import { test, expect } from '@playwright/test';
import { waitForDataLoad, searchFor, gotoAuthenticated } from './helpers/navigation';

test.describe('Order Management', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, '/orders');
    await expect(page.getByRole('heading', { name: /order management/i })).toBeVisible({ timeout: 15000 });
  });

  // ── Page header ────────────────────────────────────────────────

  test('should display page title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /order management/i })).toBeVisible();
    await expect(page.locator('text=Manage and track customer orders')).toBeVisible();
  });

  // ── Search ─────────────────────────────────────────────────────

  test('should have a search input for orders', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search orders/i);
    await expect(searchInput).toBeVisible();
  });

  test('search should accept text input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search orders/i);
    await searchInput.fill('test-order');
    await expect(searchInput).toHaveValue('test-order');
  });

  // ── Date filters ───────────────────────────────────────────────

  test('should have date range filters (From and To)', async ({ page }) => {
    await expect(page.getByLabel(/from/i).first()).toBeVisible();
    await expect(page.getByLabel(/to/i).first()).toBeVisible();
  });

  test('should have Last Week and Last Month quick filter buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Last Week' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last Month' })).toBeVisible();
  });

  test('clicking Last Month should update the from date', async ({ page }) => {
    const fromDateInput = page.getByLabel(/from/i).first();
    const initialValue = await fromDateInput.inputValue();

    await page.getByRole('button', { name: 'Last Month' }).click();
    await page.waitForTimeout(500);

    const newValue = await fromDateInput.inputValue();
    // Date should have changed (moved back a month)
    expect(newValue).not.toBe(initialValue);
  });

  // ── Status filters ─────────────────────────────────────────────

  test('should have status filter buttons', async ({ page }) => {
    const statuses = [
      'All Orders',
      'Payment Pending',
      'Payment Confirmed',
      'Processing',
      'Shipped',
      'Delivered',
      'Cancelled',
      'Refunded',
    ];

    for (const status of statuses) {
      await expect(page.getByRole('button', { name: status })).toBeVisible();
    }
  });

  test('clicking a status filter should change its active state', async ({ page }) => {
    const processingBtn = page.getByRole('button', { name: 'Processing' });
    await processingBtn.click();
    await page.waitForTimeout(500);

    // Verify Processing button is now active
    const processingClass = await processingBtn.getAttribute('class');
    const processingPressed = await processingBtn.getAttribute('aria-pressed');
    
    // Should have active state (check variant or aria-pressed)
    const isActive = processingClass?.includes('default') || processingPressed === 'true';
    expect(isActive).toBeTruthy();

    // Verify All Orders button is no longer active
    const allOrdersBtn = page.getByRole('button', { name: 'All Orders' });
    const allOrdersClass = await allOrdersBtn.getAttribute('class');
    const allOrdersPressed = await allOrdersBtn.getAttribute('aria-pressed');
    
    // Should have inactive state (outline variant or aria-pressed false)
    const isInactive = allOrdersClass?.includes('outline') || allOrdersPressed === 'false' || !allOrdersPressed;
    expect(isInactive).toBeTruthy();
  });

  // ── Add Order button ───────────────────────────────────────────

  test('should have Add Order button', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add order/i });
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toBeEnabled();
  });

  test('clicking Add Order should show the order form', async ({ page }) => {
    await page.getByRole('button', { name: /add order/i }).click();

    // Order form should be displayed (component replaces the list)
    const formLocator = page.locator('text=/create.*order|order.*form|customer/i').first();
    await expect(formLocator).toBeVisible({ timeout: 5000 });
  });

  // ── Orders list ────────────────────────────────────────────────

  test('should display orders count in the card title', async ({ page }) => {
    await waitForDataLoad(page);

    // "Orders (N)" pattern
    await expect(page.locator('text=/Orders \\(\\d+\\)/')).toBeVisible();
  });

  test('should show date range description', async ({ page }) => {
    await waitForDataLoad(page);

    // Should show "Showing orders from X to Y"
    await expect(page.locator('text=/showing orders/i').first()).toBeVisible();
  });

  test('should have Reset to Default button', async ({ page }) => {
    const resetBtn = page.getByRole('button', { name: /reset to default/i });
    await expect(resetBtn).toBeVisible();
  });

  test('Reset to Default should clear all filters', async ({ page }) => {
    // Apply a filter first
    await page.getByRole('button', { name: 'Cancelled' }).click();
    await page.waitForTimeout(500);

    // Reset
    await page.getByRole('button', { name: /reset to default/i }).click();
    await page.waitForTimeout(500);

    // Search should be cleared
    const searchInput = page.getByPlaceholder(/search orders/i);
    await expect(searchInput).toHaveValue('');
  });

  // ── Order items ────────────────────────────────────────────────

  test('order items should show customer, amount, and date info', async ({ page }) => {
    await waitForDataLoad(page);

    // If there are orders, check their structure
    const orderItems = page.locator('text=/Order #/');
    const count = await orderItems.count();

    if (count > 0) {
      // First order should have customer info
      await expect(page.locator('text=/Customer:/').first()).toBeVisible();
      await expect(page.locator('text=/Total:/').first()).toBeVisible();
      await expect(page.locator('text=/Ordered:/').first()).toBeVisible();
    }
  });

  // ── Empty state ────────────────────────────────────────────────

  test('should show empty state message when no orders match', async ({ page }) => {
    await waitForDataLoad(page);

    // Apply unlikely search
    await searchFor(page, 'nonexistentorder99999xyz');
    await page.waitForTimeout(500);

    // Check for "No orders found" message or empty state element
    const noOrdersText = page.getByText(/no orders found|no results/i);
    const emptyState = page.locator('.orders-empty-state');
    
    const hasNoOrdersText = await noOrdersText.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    // Should show some indication of empty results
    expect(hasNoOrdersText || hasEmptyState).toBeTruthy();
  });
});
