# Playwright E2E Tests

This directory contains end-to-end tests for the Cozyberries Admin application using Playwright.

## Setup

### 1. Install Dependencies

First, install the required packages:

```bash
npm install
```

Then, install Playwright browsers:

```bash
npx playwright install
```

### 2. Environment Variables

Test credentials are stored in `.env.test` file in the project root:

```env
BASE_URL=http://localhost:3001
TEST_USER_EMAIL=test@cozyberries.in
TEST_USER_PASSWORD=Test@123#
```

**Note:** The `.env.test` file is gitignored to keep credentials secure.

## Running Tests

### Run all tests (headless)
```bash
npm test
```

### Run tests with UI mode (recommended for development)
```bash
npm run test:ui
```

### Run tests in headed mode (see the browser)
```bash
npm run test:headed
```

### Run tests in debug mode
```bash
npm run test:debug
```

### Run specific test file
```bash
npx playwright test tests/auth.spec.ts
```

### Run tests in a specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## View Test Reports

After running tests, view the HTML report:

```bash
npm run test:report
```

## Test Structure

### Authentication Tests (`auth.spec.ts`)

Tests the complete authentication flow:

- ✅ Display login page correctly
- ✅ Show validation error for empty fields
- ✅ Show error for invalid credentials
- ✅ Successfully login with valid credentials
- ✅ Successfully logout after login
- ✅ Prevent access to dashboard when not authenticated
- ✅ Maintain session after page refresh

## Configuration

The Playwright configuration is defined in `playwright.config.ts`:

- **Base URL**: `http://localhost:3001`
- **Browsers**: Chromium, Firefox, WebKit
- **Reporters**: HTML report
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On first retry

## CI/CD Integration

The tests are configured to run in CI environments:

- Retries: 2 attempts on CI, 0 locally
- Parallel execution: Disabled on CI
- Server: Auto-starts dev server if not running

## Writing New Tests

Create new test files in the `tests/` directory with the `.spec.ts` extension:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/path');
    // Your test code here
  });
});
```

## Best Practices

1. **Use descriptive test names**: Clearly describe what the test validates
2. **Use proper selectors**: Prefer role-based selectors over CSS selectors
3. **Wait for navigation**: Always wait for URL changes or elements to appear
4. **Clean up**: Tests should be independent and not rely on previous test state
5. **Use environment variables**: Never hardcode sensitive data

## Troubleshooting

### Tests timing out

Increase the timeout in the test:

```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // Test code
});
```

### Server not starting

Make sure the dev server is running or configure the webServer timeout:

```typescript
// In playwright.config.ts
webServer: {
  timeout: 120000, // 2 minutes
}
```

### Browser not found

Reinstall browsers:

```bash
npx playwright install --force
```

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
