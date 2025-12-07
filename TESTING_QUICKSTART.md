# 🚀 Playwright Testing - Quick Start

## ⚡ TL;DR - Run Tests Now

```bash
# 1. Install Playwright (first time only)
npm install
npx playwright install

# 2. Run tests
npm test
```

## 📋 What Was Created

### ✅ Configuration Files
- `playwright.config.ts` - Playwright configuration
- `.env.test` - Test credentials (already configured)
- `.env.test.example` - Template for credentials
- `TESTING.md` - Comprehensive testing guide
- Updated `package.json` - Added test scripts

### ✅ Test Files
- `tests/auth.spec.ts` - Authentication tests (8 test cases)
- `tests/auth-with-helpers.spec.ts` - Tests using helper functions
- `tests/helpers/auth.ts` - Reusable authentication utilities
- `tests/setup.sh` - Automated setup script
- `tests/README.md` - Detailed testing documentation

## 🎯 Your Test Credentials

**Email:** `test@cozyberries.in`  
**Password:** `Test@123#`

These are stored securely in `.env.test` (gitignored).

## 🧪 Common Commands

| Command | When to Use |
|---------|-------------|
| `npm test` | Run all tests (headless) - CI/CD |
| `npm run test:ui` | Development mode (interactive UI) ⭐ |
| `npm run test:headed` | See the browser while testing |
| `npm run test:debug` | Step-by-step debugging |
| `npm run test:report` | View last test results |

## 📊 Test Coverage

✅ **8 Authentication Tests:**
1. Display login page correctly
2. Show validation error for empty fields
3. Show error for invalid credentials
4. Successfully login with valid credentials
5. Successfully logout after login
6. Prevent access to dashboard when not authenticated
7. Maintain session after page refresh
8. Helper function demonstrations

## 🎬 Getting Started

### Step 1: Install (First Time Only)

```bash
# Option A: Use the setup script (recommended)
./tests/setup.sh

# Option B: Manual installation
npm install
npx playwright install
```

### Step 2: Run Tests

```bash
# For development (recommended)
npm run test:ui

# For CI/CD or quick check
npm test
```

### Step 3: View Results

```bash
# Open HTML report
npm run test:report
```

## 🎨 Test Browsers

Tests run on:
- ✅ Chromium (Chrome/Edge)
- ✅ Firefox
- ✅ WebKit (Safari)

## 📁 Quick File Reference

```
cozyberries-admin/
├── playwright.config.ts           # Main config
├── .env.test                       # Your credentials ✅
├── package.json                    # Test scripts added ✅
└── tests/
    ├── auth.spec.ts               # Main tests ⭐
    ├── auth-with-helpers.spec.ts  # Helper examples
    ├── helpers/
    │   └── auth.ts                # Reusable functions
    ├── setup.sh                    # Setup script
    └── README.md                   # Full documentation
```

## 🔥 Pro Tips

1. **First time?** Use `npm run test:ui` - it's interactive and easy to learn
2. **Debugging?** Use `npm run test:debug` to step through tests
3. **CI/CD?** Use `npm test` for automated pipelines
4. **Writing tests?** Check `tests/helpers/auth.ts` for reusable functions

## ❓ Troubleshooting

### "Cannot find module '@playwright/test'"
```bash
npm install
```

### "Executable doesn't exist"
```bash
npx playwright install
```

### "Port 3001 already in use"
```bash
# Kill the process
lsof -ti:3001 | xargs kill -9

# Or start dev server manually
npm run dev
```

### Tests failing?
1. Make sure dev server is running: `npm run dev`
2. Check credentials in `.env.test`
3. Run in UI mode to see what's happening: `npm run test:ui`

## 📚 Learn More

- Full guide: Read `TESTING.md`
- Detailed docs: Check `tests/README.md`
- Playwright docs: https://playwright.dev/

## ✨ Next Steps

1. ✅ Run tests: `npm test`
2. ✅ View report: `npm run test:report`
3. ✅ Write new tests for other features
4. ✅ Add to CI/CD pipeline

---

**Ready to test? Run:** `npm run test:ui` 🎭
