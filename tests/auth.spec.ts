import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const testEmail = process.env.TEST_ADMIN_EMAIL || process.env.TEST_USER_EMAIL!;
  const testPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_USER_PASSWORD!;

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // ── Login page UI ──────────────────────────────────────────────

  test('should display login page with correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
  });

  test('should display email and password input fields', async ({ page }) => {
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should display Sign In button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /^sign in$/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('should display Continue with Google button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('should display "create a new account" link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /create a new account/i })).toBeVisible();
  });

  test('should display "Or continue with" separator', async ({ page }) => {
    await expect(page.locator('text=Or continue with')).toBeVisible();
  });

  // ── Input validation ───────────────────────────────────────────

  test('should show HTML5 validation for empty email', async ({ page }) => {
    await page.getByRole('button', { name: /^sign in$/i }).click();

    const emailInput = page.getByLabel(/email address/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test('should show HTML5 validation for invalid email format', async ({ page }) => {
    await page.getByLabel(/email address/i).fill('notanemail');
    await page.getByLabel(/password/i).fill('somepassword');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    const emailInput = page.getByLabel(/email address/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test('should show HTML5 validation for empty password after filling email', async ({ page }) => {
    await page.getByLabel(/email address/i).fill('test@example.com');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    const passwordInput = page.getByLabel(/password/i);
    const isInvalid = await passwordInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  // ── Invalid credentials ────────────────────────────────────────

  test('should show error for wrong email and password', async ({ page }) => {
    await page.getByLabel(/email address/i).fill('wrong@email.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Error message should appear (red text)
    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for correct email but wrong password', async ({ page }) => {
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/password/i).fill('definitelywrongpassword');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 10000 });
  });

  test('Sign In button should show loading state during submission', async ({ page }) => {
    await page.getByLabel(/email address/i).fill('wrong@email.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    const signInBtn = page.getByRole('button', { name: /^sign in$/i });
    await signInBtn.click();

    // Button should briefly show "Signing in..." text
    await expect(page.locator('text=Signing in...')).toBeVisible({ timeout: 5000 });
  });

  // ── Successful login ───────────────────────────────────────────

  test('should successfully login with valid admin credentials', async ({ page }) => {
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('/', { timeout: 30000 });
    await expect(page).toHaveURL('/');

    // Should not be on login page anymore
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).not.toBeVisible();

    // Admin Panel should be visible
    await expect(page.locator('text=Admin Panel').first()).toBeVisible({ timeout: 15000 });
  });

  // ── Logout ─────────────────────────────────────────────────────

  test('should successfully logout after login', async ({ page }) => {
    // Login
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL('/', { timeout: 30000 });

    // Find and click Sign Out
    const signOutBtn = page.getByRole('button', { name: /sign out/i }).first();
    await expect(signOutBtn).toBeVisible({ timeout: 10000 });
    await signOutBtn.click();

    // Should redirect to login or home
    await page.waitForURL(/\/(login)?/, { timeout: 15000 });
  });

  // ── Protected routes ───────────────────────────────────────────

  test('should redirect unauthenticated user from / to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
  });

  test('should redirect unauthenticated user from /products to /login', async ({ page }) => {
    await page.goto('/products');
    await page.waitForURL(/\/login/, { timeout: 15000 });
  });

  test('should redirect unauthenticated user from /orders to /login', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForURL(/\/login/, { timeout: 15000 });
  });

  test('should redirect unauthenticated user from /users to /login', async ({ page }) => {
    await page.goto('/users');
    await page.waitForURL(/\/login/, { timeout: 15000 });
  });

  test('should redirect unauthenticated user from /expenses to /login', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForURL(/\/login/, { timeout: 15000 });
  });

  test('should redirect unauthenticated user from /settings to /login', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/\/login/, { timeout: 15000 });
  });

  // ── Session persistence ────────────────────────────────────────

  test('should maintain session after page refresh', async ({ page }) => {
    // Login
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL('/', { timeout: 30000 });

    // Refresh
    await page.reload();

    // Should remain on dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).not.toBeVisible();
  });

  // ── Redirect with query param ──────────────────────────────────

  test('login redirect should include original path in URL', async ({ page }) => {
    await page.goto('/products');
    // Should redirect to /login?redirect=/products
    await page.waitForURL(/\/login/, { timeout: 15000 });

    const url = page.url();
    expect(url).toContain('redirect');
  });

  // ── Setup page access ─────────────────────────────────────────

  test('setup page should be accessible without auth', async ({ page }) => {
    await page.goto('/setup');
    // Setup page should not redirect to login
    await expect(page).toHaveURL('/setup');
  });
});
