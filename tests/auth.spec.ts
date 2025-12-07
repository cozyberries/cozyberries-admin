import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const testEmail = process.env.TEST_USER_EMAIL!;
  const testPassword = process.env.TEST_USER_PASSWORD!;

  test.beforeEach(async ({ page }) => {
    // Navigate to the login page before each test
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    // Check if the login page is displayed
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
    
    // Check if email and password fields are present
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    
    // Check if sign in button is present
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    
    // Check if Google sign in button is present
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('should show validation error for empty fields', async ({ page }) => {
    // Try to submit without filling in credentials
    await page.getByRole('button', { name: /^sign in$/i }).click();
    
    // HTML5 validation should prevent submission
    const emailInput = page.getByLabel(/email address/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByLabel(/email address/i).fill('wrong@email.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    
    // Click sign in button
    await page.getByRole('button', { name: /^sign in$/i }).click();
    
    // Wait for error message to appear
    await expect(page.locator('text=/invalid.*credentials|error/i')).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Fill in valid credentials
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    
    // Click sign in button
    await page.getByRole('button', { name: /^sign in$/i }).click();
    
    // Wait for navigation to complete
    await page.waitForURL('/', { timeout: 15000 });
    
    // Verify we're on the dashboard (check for admin-specific elements)
    await expect(page).toHaveURL('/');
    
    // Wait for the page to load and check for dashboard elements
    // This could be analytics dashboard, admin layout, or other admin-specific content
    await expect(page.locator('body')).toBeVisible();
    
    // Verify we're not on the login page anymore
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).not.toBeVisible();
  });

  test('should successfully logout after login', async ({ page }) => {
    // First, login
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    
    // Wait for navigation to dashboard
    await page.waitForURL('/', { timeout: 15000 });
    
    // Look for logout/sign out button or dropdown menu
    // Typically in navigation or user menu
    const signOutButton = page.getByRole('button', { name: /sign out|logout/i });
    
    // If sign out is in a dropdown, we might need to open it first
    const userMenuButton = page.getByRole('button', { name: /user|account|profile/i }).first();
    
    // Try to find and click the sign out button
    try {
      // First try direct sign out button
      if (await signOutButton.isVisible({ timeout: 2000 })) {
        await signOutButton.click();
      } else {
        // If not visible, try opening user menu first
        await userMenuButton.click();
        await signOutButton.click();
      }
    } catch (error) {
      // If we can't find the sign out button, look for any button/link with sign out text
      await page.locator('text=/sign out|logout/i').first().click();
    }
    
    // Wait for redirect to login page
    await page.waitForURL('/login', { timeout: 10000 });
    
    // Verify we're back on the login page
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
  });

  test('should prevent access to dashboard when not authenticated', async ({ page }) => {
    // Try to navigate directly to dashboard without logging in
    await page.goto('/');
    
    // Should be redirected to login page
    await page.waitForURL(/\/login/, { timeout: 10000 });
    
    // Verify we're on the login page
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
  });

  test('should maintain session after page refresh', async ({ page }) => {
    // Login first
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    
    // Wait for navigation to dashboard
    await page.waitForURL('/', { timeout: 15000 });
    
    // Refresh the page
    await page.reload();
    
    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).not.toBeVisible();
  });
});
