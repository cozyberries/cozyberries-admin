# Testing Guide for Cozyberries Admin

This guide covers the automated testing setup for the Cozyberries Admin application using Playwright.

## 🎯 What's Included

The testing setup includes:

- **Playwright E2E Tests** - Comprehensive end-to-end testing framework
- **Authentication Tests** - Login, logout, and session management validation
- **Test Helpers** - Reusable authentication utilities
- **Environment Configuration** - Secure credential management
- **CI/CD Ready** - Configured for automated testing pipelines

## 📁 File Structure

```
cozyberries-admin/
├── playwright.config.ts           # Playwright configuration
├── .env.test                       # Test credentials (gitignored)
├── .env.test.example              # Example credentials template
├── package.json                    # Updated with test scripts
└── tests/
    ├── README.md                   # Detailed testing documentation
    ├── setup.sh                    # Automated setup script
    ├── auth.spec.ts               # Main authentication tests
    ├── auth-with-helpers.spec.ts  # Tests using helper functions
    └── helpers/
        └── auth.ts                # Reusable authentication utilities
```

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
./tests/setup.sh

# Update .env.test with your credentials (already done for you)
# TEST_USER_EMAIL=test@cozyberries.in
# TEST_USER_PASSWORD=Test@123#

# Run tests
npm test
```

### Option 2: Manual Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Copy and configure environment variables
cp .env.test.example .env.test
# Edit .env.test with your test credentials

# Run tests
npm test
```

## 🧪 Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests in headless mode |
| `npm run test:ui` | Run tests with interactive UI (recommended for development) |
| `npm run test:headed` | Run tests with visible browser |
| `npm run test:debug` | Run tests in debug mode with Playwright Inspector |
| `npm run test:report` | View the last test report |

## ✅ Test Coverage

### Authentication Tests (`auth.spec.ts`)

1. **Display Login Page** - Verifies all login page elements are visible
2. **Empty Field Validation** - Checks HTML5 validation for empty fields
3. **Invalid Credentials** - Tests error handling for wrong credentials
4. **Successful Login** - Validates complete login flow with valid credentials
5. **Logout Flow** - Tests sign out functionality
6. **Unauthorized Access** - Ensures unauthenticated users are redirected
7. **Session Persistence** - Verifies session is maintained after page refresh

### Helper Function Tests (`auth-with-helpers.spec.ts`)

Demonstrates the use of reusable authentication helpers:
- Login/logout using helper functions
- Error handling with helpers
- Form filling with helpers

## 🔒 Test Credentials

Your test credentials are securely stored in `.env.test`:

```env
TEST_USER_EMAIL=test@cozyberries.in
TEST_USER_PASSWORD=Test@123#
```

**Important:** The `.env.test` file is gitignored and will not be committed to version control.

## 🎨 Test Configuration

### Browsers

Tests run on multiple browsers:
- ✅ Chromium (Chrome/Edge)
- ✅ Firefox
- ✅ WebKit (Safari)

### Features

- **Automatic Retries**: 2 retries on CI, 0 locally
- **Screenshots**: Captured on test failure
- **Videos**: Recorded on test failure
- **Traces**: Collected on first retry
- **Parallel Execution**: Enabled locally, sequential on CI
- **Auto Server Start**: Dev server starts automatically if not running

## 📊 Viewing Test Reports

After running tests, view the detailed HTML report:

```bash
npm run test:report
```

The report includes:
- Test execution timeline
- Screenshots of failures
- Video recordings of failures
- Step-by-step traces
- Browser console logs

## 🔍 Debugging Tests

### Interactive UI Mode (Best for Development)

```bash
npm run test:ui
```

Features:
- Watch mode - tests re-run on file changes
- Time travel debugging
- Pick locators
- View trace

### Debug Mode

```bash
npm run test:debug
```

Opens Playwright Inspector for step-by-step debugging.

### Headed Mode

```bash
npm run test:headed
```

Runs tests with visible browser windows.

## 🛠 Helper Functions

Reusable authentication utilities in `tests/helpers/auth.ts`:

```typescript
// Login helper
await login(page, email, password);

// Logout helper
await logout(page);

// Fill login form without submitting
await fillLoginForm(page, email, password);

// Submit login form
await submitLoginForm(page);

// Get login error message
const error = await getLoginError(page);

// Check authentication status
const isAuth = await isAuthenticated(page);
```

## 🚀 CI/CD Integration

The tests are ready for CI/CD pipelines. Example GitHub Actions workflow:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 📝 Writing New Tests

Create a new test file in the `tests/` directory:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should perform action', async ({ page }) => {
    await page.goto('/path');
    
    // Your test assertions
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

## 🎯 Best Practices

1. **Use Role-Based Selectors** - Prefer `getByRole()` over CSS selectors
2. **Wait for Navigation** - Always wait for URL changes or element visibility
3. **Independent Tests** - Each test should be self-contained
4. **Descriptive Names** - Clearly describe what the test validates
5. **Use Helpers** - Leverage helper functions for common operations
6. **Environment Variables** - Never hardcode credentials

## 🐛 Troubleshooting

### Tests Timeout
Increase timeout for slow operations:
```typescript
test.setTimeout(60000); // 60 seconds
```

### Browser Not Found
Reinstall browsers:
```bash
npx playwright install --force
```

### Dev Server Issues
Ensure the dev server is running on the correct port (3001):
```bash
npm run dev
```

### Port Already in Use
Kill the process using port 3001:
```bash
lsof -ti:3001 | xargs kill -9
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Test Generation](https://playwright.dev/docs/codegen)

## 🎉 Success Criteria

Your tests are working correctly when:
- ✅ All 8 authentication tests pass
- ✅ Tests run on all 3 browsers (Chromium, Firefox, WebKit)
- ✅ Test report is generated successfully
- ✅ Screenshots/videos captured on failures
- ✅ No hardcoded credentials in test files

## 🔄 Next Steps

1. **Run Initial Tests**: Execute `npm test` to verify setup
2. **Explore UI Mode**: Try `npm run test:ui` for interactive development
3. **Write Custom Tests**: Add tests for other admin features
4. **CI/CD Integration**: Set up automated testing in your pipeline
5. **Expand Coverage**: Add tests for products, orders, expenses, etc.

---

**Happy Testing! 🎭**
