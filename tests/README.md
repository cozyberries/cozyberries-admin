# Playwright E2E Tests

Comprehensive end-to-end tests for the Cozyberries Admin application using Playwright.

## Setup

### 1. Install Dependencies

```bash
npm install
npx playwright install
```

### 2. Create Test Admin User

Create a Supabase user with admin privileges for testing:

1. Go to your Supabase dashboard > Authentication > Users
2. Create a new user with email `testadmin@cozyberries.in` and password `TestAdmin@2026#`
3. In the `user_profiles` table, set the role to `admin` or `super_admin` for this user

### 3. Environment Variables

Test credentials are stored in `.env.test` file in the project root:

```env
BASE_URL=http://localhost:3001

# Test Admin Credentials (must have admin or super_admin role)
TEST_ADMIN_EMAIL=testadmin@cozyberries.in
TEST_ADMIN_PASSWORD=TestAdmin@2026#
TEST_USER_EMAIL=testadmin@cozyberries.in
TEST_USER_PASSWORD=TestAdmin@2026#
```

**Note:** `.env.test` is gitignored. Copy from the template and update.

## Running Tests

```bash
# Run all tests (headless)
npm test

# Run tests with interactive UI
npm run test:ui

# Run tests with browser visible
npm run test:headed

# Run tests in debug mode
npm run test:debug

# Run specific test file
npx playwright test tests/auth.spec.ts

# Run specific test suite
npx playwright test tests/products.spec.ts

# Run only auth tests (no pre-auth state)
npx playwright test --project=auth-tests

# Run only chromium tests (with pre-auth)
npx playwright test --project=chromium

# Show HTML report
npm run test:report
```

## Test Structure

### Authentication Setup (`auth.setup.ts`)
Runs first to create authenticated browser state saved to `tests/.auth/admin.json`. All other tests (except auth) reuse this state — no repeated logins.

### Test Specs

| File | Tests | Description |
|------|-------|-------------|
| `auth.spec.ts` | 18 | Login page UI, validation, invalid credentials, successful login/logout, protected routes, session persistence |
| `dashboard.spec.ts` | 8 | Stat cards, monthly stats, expense widget, activities, layout assertions |
| `navigation.spec.ts` | 12 | Sidebar navigation to all pages, active link styling, direct URL access |
| `products.spec.ts` | 11 | Page header, search/filter, product cards, Add Product form, empty state |
| `orders.spec.ts` | 12 | Search, date filters, status filters, Add Order, orders list, reset |
| `users.spec.ts` | 11 | Search, table columns, user rows, status badges, action dropdown, empty state |
| `expenses.spec.ts` | 10 | Tabs switching, search, filters, table, status badges, access control |
| `settings.spec.ts` | 13 | All settings sections (General, Email, Security, Notifications, Database), toggle switches, form editing |
| `api.spec.ts` | 15 | API route responses, auth enforcement, invalid methods, non-existent routes |
| `responsive.spec.ts` | 5 | Mobile viewport, hamburger menu, mobile navigation, overflow checks |

**Total: ~115 test cases**

### Helpers

| File | Exports | Description |
|------|---------|-------------|
| `helpers/auth.ts` | `login`, `logout`, `isAuthenticated`, etc. | Auth utility functions |
| `helpers/navigation.ts` | `navigateViaSidebar`, `waitForDataLoad`, `searchFor`, etc. | Navigation & interaction helpers |

## Configuration

Defined in `playwright.config.ts`:

- **Base URL**: `http://localhost:3001`
- **Projects**: `setup` → `chromium` (pre-auth), `auth-tests` (no pre-auth)
- **Timeout**: 60s per test, 15s actions, 30s navigation
- **Reporters**: HTML report
- **Artifacts**: Screenshots, videos, traces on failure
- **Dev Server**: Auto-starts via `npm run dev`

## CI/CD Integration

- Retries: 2 on CI, 0 locally
- Workers: 1 on CI, auto locally
- Server: Auto-starts if not running
- `test.only` detection: Fails build on CI

## Troubleshooting

### Tests timing out
- Increase timeout: `test.setTimeout(90000)` inside the test
- Check if dev server is running on port 3001

### Auth setup failing
- Verify `.env.test` credentials are correct
- Verify the test user exists in Supabase with admin role
- Check `user_profiles` table has the correct role

### Browser not found
```bash
npx playwright install --force
```

## Resources

- [Playwright Docs](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Locators](https://playwright.dev/docs/locators)
