import { Page, expect } from '@playwright/test';

/**
 * Ensure the user is logged in. If the page shows the login form, log in first.
 * Call this after navigating to a protected page.
 */
export async function ensureLoggedIn(page: Page) {
  // Check if we landed on the login page
  const isLoginPage = page.url().includes('/login');
  if (isLoginPage) {
    await loginAsAdmin(page);
  }
}

/**
 * Navigate to a protected page and ensure we're logged in.
 * If we get redirected to login, we log in first and then navigate to the target.
 */
export async function gotoAuthenticated(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // Wait for redirect to login if the app sends us there
  await page.waitForLoadState('networkidle');
  const wasOnLogin = page.url().includes('/login');
  if (wasOnLogin) {
    await loginAsAdmin(page);
    // After login, wait for successful navigation off login (default redirect is '/')
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    // Navigate to the intended page if it wasn't '/'
    if (path !== '/') {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
    }
  }
  // When not on login, the initial goto + networkidle above already ensured the page is loaded.
}

/**
 * Navigate to a page via the sidebar and verify the heading.
 */
export async function navigateViaSidebar(
  page: Page,
  linkName: string,
  expectedUrl: string,
  expectedHeading: string | RegExp
) {
  // Click the sidebar link (desktop)
  await page.getByRole('link', { name: linkName }).first().click();
  await page.waitForURL(expectedUrl, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for page data to load (skeleton loaders disappear).
 */
export async function waitForDataLoad(page: Page, timeout = 15000) {
  // Wait for skeleton loaders to disappear
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse').length === 0,
    { timeout }
  );
}

/**
 * Login helper for tests that don't use stored auth state.
 * Includes retry logic for Supabase rate limiting.
 */
export async function loginAsAdmin(page: Page, retries = 3) {
  const email = process.env.TEST_ADMIN_EMAIL || process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_USER_PASSWORD;

  if (!email || email.trim() === '') {
    throw new Error(
      'Missing TEST_ADMIN_EMAIL or TEST_USER_EMAIL. Set one of these environment variables for login tests.'
    );
  }
  if (!password || password.trim() === '') {
    throw new Error(
      'Missing TEST_ADMIN_PASSWORD or TEST_USER_PASSWORD. Set one of these environment variables for login tests.'
    );
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible({ timeout: 10000 });
    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    try {
      await page.waitForURL('/', { timeout: 30000, waitUntil: 'domcontentloaded' });
      return; // Login succeeded
    } catch {
      // Check if it was a rate limit error
      const rateLimited = await page.locator('text=/rate limit/i').isVisible().catch(() => false);
      if (rateLimited && attempt < retries) {
        // Wait before retrying (exponential backoff: 3s, 6s, 12s)
        const delay = 3000 * Math.pow(2, attempt - 1);
        await page.waitForTimeout(delay);
        continue;
      }

      // Check if we actually navigated away from login (might just be slow)
      if (!page.url().includes('/login')) {
        return; // We're not on login page anymore, login succeeded
      }

      if (attempt >= retries) {
        throw new Error(`Login failed after ${retries} attempts. Last URL: ${page.url()}`);
      }
    }
  }
}

/**
 * Search within a management page search box.
 * Waits for the search to be applied (network idle and/or results UI to settle).
 */
export async function searchFor(page: Page, term: string) {
  const searchInput = page.getByPlaceholder(/search/i).first();
  await searchInput.fill(term);
  // Wait for debounced API requests to finish, or client-side re-render to settle
  await page.waitForLoadState('networkidle');
}

/**
 * Get the count text from a card title (e.g., "Users (15)").
 */
export async function getCountFromTitle(page: Page, titlePattern: RegExp): Promise<string> {
  const title = page.locator('h3, [class*="CardTitle"]').filter({ hasText: titlePattern }).first();
  return (await title.textContent()) || '';
}
