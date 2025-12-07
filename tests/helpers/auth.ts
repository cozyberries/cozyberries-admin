import { Page } from '@playwright/test';

/**
 * Login helper function to authenticate a user
 * @param page - Playwright page instance
 * @param email - User email (defaults to TEST_USER_EMAIL env var)
 * @param password - User password (defaults to TEST_USER_PASSWORD env var)
 */
export async function login(
  page: Page,
  email?: string,
  password?: string
): Promise<void> {
  const userEmail = email || process.env.TEST_USER_EMAIL!;
  const userPassword = password || process.env.TEST_USER_PASSWORD!;

  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.getByLabel(/email address/i).fill(userEmail);
  await page.getByLabel(/password/i).fill(userPassword);

  // Click sign in button
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Wait for navigation to dashboard
  await page.waitForURL('/', { timeout: 15000 });
}

/**
 * Logout helper function to sign out the current user
 * @param page - Playwright page instance
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout/sign out button or dropdown menu
  const signOutButton = page.getByRole('button', { name: /sign out|logout/i });
  const userMenuButton = page.getByRole('button', { name: /user|account|profile/i }).first();

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
}

/**
 * Check if user is authenticated by checking for login page redirect
 * @param page - Playwright page instance
 * @returns boolean - true if authenticated, false otherwise
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.goto('/');
    await page.waitForURL('/', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Navigate to login page
 * @param page - Playwright page instance
 */
export async function navigateToLogin(page: Page): Promise<void> {
  await page.goto('/login');
}

/**
 * Fill login form without submitting
 * @param page - Playwright page instance
 * @param email - User email
 * @param password - User password
 */
export async function fillLoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
}

/**
 * Submit login form (assumes form is already filled)
 * @param page - Playwright page instance
 */
export async function submitLoginForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

/**
 * Wait for login error message to appear
 * @param page - Playwright page instance
 * @returns Promise<string | null> - Error message text or null if no error
 */
export async function getLoginError(page: Page): Promise<string | null> {
  try {
    const errorElement = page.locator('text=/invalid.*credentials|error/i').first();
    await errorElement.waitFor({ timeout: 5000 });
    return await errorElement.textContent();
  } catch {
    return null;
  }
}
