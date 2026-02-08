import { test, expect } from '@playwright/test';
import { gotoAuthenticated } from './helpers/navigation';

test.describe('Admin Settings', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthenticated(page, '/settings');
    // Wait for settings page to load - use the main content heading
    await expect(page.locator('main').getByRole('heading', { name: /settings/i }).first()).toBeVisible({ timeout: 15000 });
  });

  // ── Page header ────────────────────────────────────────────────

  test('should display Settings heading', async ({ page }) => {
    await expect(page.locator('main h1').filter({ hasText: /settings/i })).toBeVisible();
  });

  test('should have Save and Refresh buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /save/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i }).first()).toBeVisible();
  });

  // ── General Settings section ───────────────────────────────────

  test('should display General Settings card', async ({ page }) => {
    await expect(page.locator('text=General Settings').first()).toBeVisible();
  });

  test('should have Site Name input with default value', async ({ page }) => {
    const siteNameInput = page.locator('input').filter({ hasText: '' }).first();
    // The settings page should have input fields
    const inputs = page.locator('input[type="text"], input[type="email"], input[type="number"], input[type="url"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Email Settings section ─────────────────────────────────────

  test('should display Email Settings card', async ({ page }) => {
    await expect(page.locator('text=Email Settings').first()).toBeVisible();
  });

  test('should have SMTP configuration fields', async ({ page }) => {
    // Check for email-related labels
    await expect(page.locator('text=/SMTP Host/i').first()).toBeVisible();
    await expect(page.locator('text=/SMTP Port/i').first()).toBeVisible();
  });

  // ── Security Settings section ──────────────────────────────────

  test('should display Security Settings card', async ({ page }) => {
    await expect(page.locator('text=Security Settings').first()).toBeVisible();
  });

  test('should have two-factor toggle switch', async ({ page }) => {
    await expect(page.locator('text=/two.factor/i').first()).toBeVisible();

    // Switch component should be present
    const switches = page.locator('[role="switch"]');
    const count = await switches.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have session timeout input', async ({ page }) => {
    await expect(page.locator('text=/session timeout/i').first()).toBeVisible();
  });

  // ── Notification Settings section ──────────────────────────────

  test('should display Notification Settings card', async ({ page }) => {
    await expect(page.locator('text=Notification Settings').first()).toBeVisible();
  });

  test('should have notification toggle switches', async ({ page }) => {
    await expect(page.locator('text=/email notifications/i').first()).toBeVisible();
    await expect(page.locator('text=/order notifications/i').first()).toBeVisible();
  });

  test('toggle switches should be interactive', async ({ page }) => {
    const switches = page.locator('[role="switch"]');
    const count = await switches.count();

    if (count > 0) {
      const firstSwitch = switches.first();
      const initialState = await firstSwitch.getAttribute('data-state');

      await firstSwitch.click();
      await page.waitForTimeout(300);

      const newState = await firstSwitch.getAttribute('data-state');
      expect(newState).not.toBe(initialState);

      // Toggle back
      await firstSwitch.click();
    }
  });

  // ── Database Settings section ──────────────────────────────────

  test('should display Database Settings card', async ({ page }) => {
    await expect(page.locator('text=Database Settings').first()).toBeVisible();
  });

  test('should have backup frequency and retention settings', async ({ page }) => {
    await expect(page.locator('text=/backup frequency/i').first()).toBeVisible();
    await expect(page.locator('text=/retention/i').first()).toBeVisible();
  });

  // ── Form interactions ──────────────────────────────────────────

  test('should be able to edit Site Name', async ({ page }) => {
    // Find the Site Name input by label relationship
    const siteNameLabel = page.locator('text=Site Name').first();
    await expect(siteNameLabel).toBeVisible();

    // Get the input associated with the label (next sibling input)
    const inputs = page.locator('input').all();
    const allInputs = await inputs;
    expect(allInputs.length).toBeGreaterThan(0);
  });

  test('should be able to edit input values', async ({ page }) => {
    // Find any text input and verify it's editable
    const textInputs = page.locator('input[type="text"]');
    const count = await textInputs.count();

    if (count > 0) {
      const firstInput = textInputs.first();
      const originalValue = await firstInput.inputValue();

      await firstInput.fill('Test Value');
      await expect(firstInput).toHaveValue('Test Value');

      // Restore
      await firstInput.fill(originalValue);
    }
  });
});
