import { test, expect } from '@playwright/test';
import { login, logout, fillLoginForm, submitLoginForm, getLoginError } from './helpers/auth';

test.describe('Authentication Flow (Using Helpers)', () => {
  let testEmail: string;
  let testPassword: string;

  test.beforeAll(() => {
    const email = process.env.TEST_ADMIN_EMAIL || process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_USER_PASSWORD;
    
    if (!email || !password) {
      throw new Error(
        'Missing required env vars for auth tests. Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD (or TEST_USER_EMAIL and TEST_USER_PASSWORD).'
      );
    }
    
    testEmail = email;
    testPassword = password;
  });

  test('should login and logout using helper functions', async ({ page }) => {
    // Login using helper
    await login(page);

    // Verify we're on the dashboard
    await expect(page).toHaveURL('/');

    // Logout using helper
    await logout(page);

    // Verify we're back on login page
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
  });

  test('should show error for invalid credentials using helpers', async ({ page }) => {
    await page.goto('/login');

    // Fill form with invalid credentials
    await fillLoginForm(page, 'wrong@email.com', 'wrongpassword');

    // Submit form
    await submitLoginForm(page);

    // Check for error using helper
    const errorMessage = await getLoginError(page);
    expect(errorMessage).toBeTruthy();
  });

  test('should successfully authenticate with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill form with valid credentials
    await fillLoginForm(page, testEmail, testPassword);

    // Submit form
    await submitLoginForm(page);

    // Wait for navigation (use domcontentloaded for faster response)
    await page.waitForURL('/', { timeout: 30000, waitUntil: 'domcontentloaded' });

    // Verify we're authenticated
    await expect(page).toHaveURL('/');
  });
});
