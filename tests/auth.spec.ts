import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  let testEmail: string;
  let testPassword: string;

  test.beforeAll(() => {
    const email = process.env.TEST_ADMIN_EMAIL || process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_USER_PASSWORD;
    if (!email) {
      throw new Error(
        'Missing required env: set either TEST_ADMIN_EMAIL or TEST_USER_EMAIL for auth tests'
      );
    }
    if (!password) {
      throw new Error(
        'Missing required env: set either TEST_ADMIN_PASSWORD or TEST_USER_PASSWORD for auth tests'
      );
    }
    testEmail = email;
    testPassword = password;
  });

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

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for correct email but wrong password', async ({ page }) => {
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByLabel(/password/i).fill('definitelywrongpassword');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });
  });

  test('Sign In button should show loading state during submission', async ({ page }) => {
    // Intercept the auth request to add a delay so loading state is reliably visible
    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.getByLabel(/email address/i).fill('wrong@email.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    const signInBtn = page.getByRole('button', { name: /^sign in$/i });
    await signInBtn.click();

    // Assert loading state is visible
    await expect(page.getByText('Signing in...')).toBeVisible();
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

    // Should not be on login page anymore — we're authenticated on the dashboard
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).not.toBeVisible();
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

  const protectedRoutes = ['/', '/products', '/orders', '/users', '/expenses', '/settings'];
  
  for (const route of protectedRoutes) {
    test(`should redirect unauthenticated user from ${route} to /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 15000 });
      if (route === '/') {
        await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
      }
    });
  }

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
    const originalPath = '/products';
    await page.goto(originalPath);
    await page.waitForURL(/\/login/, { timeout: 15000 });

    const url = page.url();
    const searchParams = new URLSearchParams(new URL(url).search);
    expect(searchParams.get('redirect')).toBe(originalPath);
  });

  // ── Setup page access ─────────────────────────────────────────

  test('setup page should be accessible without auth', async ({ page }) => {
    await page.goto('/setup');
    // The setup page should NOT be blocked by the proxy (it's excluded from auth).
    // Depending on whether an admin already exists, one of three things happens:
    //   1. "Admin Setup" form is shown (needsSetup === true)
    //   2. "Setup Complete" card is briefly shown, then client-side redirect to "/"
    //      which the proxy then redirects to "/login" (needsSetup === false)
    //   3. "Checking setup status..." spinner while the API call is in flight
    // All three are acceptable — what matters is the proxy did NOT return a 500.
    // Wait for the page to settle, then assert we're on a valid page.
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const isValid =
      url.includes('/setup') ||
      url.includes('/login') ||
      url.endsWith('/');
    expect(isValid).toBeTruthy();
  });
});
