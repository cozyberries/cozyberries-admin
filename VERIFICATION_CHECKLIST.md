# Verification Checklist

Use this checklist to verify all fixes have been properly applied.

## Before Testing

- [ ] Apply database migration: `database/migrations/ensure_single_default_address.sql`
  - Copy the SQL and run it in Supabase SQL Editor
  - OR run: `supabase db execute --file database/migrations/ensure_single_default_address.sql`
- [ ] Verify the function was created: Check for `ensure_single_default_address` in Supabase Functions

## Code Changes Verification

### 1. Address Update Route (`app/api/profile/addresses/[id]/route.ts`)

- [ ] Line 38-53: Default clearing logic added before update
  - [ ] Checks `if (body.is_default === true)`
  - [ ] Updates other addresses with `.neq("id", id)`
  - [ ] Logs errors server-side
  - [ ] Returns generic error message to client

### 2. Address Creation Route (`app/api/profile/addresses/route.ts`)

- [ ] Line 86-127: RPC call replaces two-step operation
  - [ ] Calls `supabase.rpc('ensure_single_default_address', {...})`
  - [ ] All address fields passed as parameters
  - [ ] Error logged server-side
  - [ ] Generic error message returned to client
  - [ ] Response extracts first row from RPC result array

### 3. ExpenseDashboard Component (`components/admin/ExpenseDashboard.tsx`)

- [ ] Line 64-72: Summary response JSON parsing wrapped in try-catch
  - [ ] Logs parse error to console
  - [ ] Sets `fetchError` state on error
  - [ ] Doesn't break execution
- [ ] Line 74-84: Expenses response JSON parsing wrapped in try-catch
  - [ ] Logs parse error to console
  - [ ] Sets `fetchError` only if not already set
  - [ ] Doesn't break execution
- [ ] Line 92: `setLoading(false)` always executes

### 4. API Tests (`tests/api.spec.ts`)

- [ ] Line 155-161: Setup route test updated
  - [ ] Test name mentions "malformed JSON should return 400"
  - [ ] Assertion: `expect(response.status()).toBe(400)`
- [ ] Line 125-131: Generate token test updated
  - [ ] Test name mentions "malformed JSON should return 400"
  - [ ] Assertion: `expect(response.status()).toBe(400)`

### 5. Auth Test (`tests/auth.spec.ts`)

- [ ] Line 104-113: Loading state test fixed
  - [ ] Uses `page.route('**/auth/v1/token**', ...)` for interception
  - [ ] Adds 500ms delay in route handler
  - [ ] Route interception set up before clicking
  - [ ] Uses `expect(...).toBeVisible()` instead of `waitFor`

### 6. Generate Token Handler (`app/api/auth/generate-token/route.ts`)

- [ ] Line 5-17: JSON parsing wrapped in try-catch
  - [ ] Inner try-catch for `request.json()`
  - [ ] Catches parse errors
  - [ ] Returns 400 with "Invalid JSON in request body"
  - [ ] Logs error to console

### 7. Setup Handler (`app/api/setup/route.ts`)

- [ ] Line 8-28: JSON parsing wrapped in try-catch
  - [ ] Inner try-catch for `request.json()`
  - [ ] Catches parse errors
  - [ ] Returns 400 with "Invalid JSON in request body"
  - [ ] Logs error to console

## Manual Testing

### Address Routes

- [ ] Create an address with `is_default: true`
- [ ] Create another address with `is_default: true`
- [ ] Verify only the second address is default
- [ ] Update a non-default address to `is_default: true`
- [ ] Verify previous default is now false
- [ ] Try concurrent requests setting different addresses as default
- [ ] Verify only one default exists (no race condition)

### API Error Handling

- [ ] Send malformed JSON to `/api/auth/generate-token`
  ```bash
  curl -X POST http://localhost:4000/api/auth/generate-token \
    -H "Content-Type: application/json" \
    -d 'not valid json'
  ```
  Expected: 400 status with error message

- [ ] Send malformed JSON to `/api/setup`
  ```bash
  curl -X POST http://localhost:4000/api/setup \
    -H "Content-Type: application/json" \
    -d 'not valid json'
  ```
  Expected: 400 status with error message

### ExpenseDashboard

- [ ] Mock API to return invalid JSON
- [ ] Verify component shows error message
- [ ] Verify component is not stuck in loading state
- [ ] Check browser console for logged errors

## Automated Testing

- [ ] Run all tests: `npm test`
- [ ] Specifically run API tests: `npm test tests/api.spec.ts`
- [ ] Specifically run auth tests: `npm test tests/auth.spec.ts`
- [ ] Verify no flaky test failures on auth loading state test
- [ ] All tests should pass

## Review Logs

- [ ] Check server logs for "Failed to clear existing defaults" (should not appear)
- [ ] Check server logs for "Failed to create address via RPC" (should not appear)
- [ ] Check server logs for "Invalid JSON in request body" (when testing malformed JSON)
- [ ] Verify no raw error messages exposed to client

## Documentation

- [ ] Review `BUG_FIXES_SUMMARY.md` for accuracy
- [ ] Review `database/README.md` for completeness
- [ ] Ensure migration SQL file is properly formatted

## Deployment Checklist

- [ ] Database migration applied to production
- [ ] Code deployed to production
- [ ] Smoke test address creation and updates
- [ ] Monitor logs for any RPC errors
- [ ] Verify no increase in 500 errors
- [ ] Confirm test suite passes in CI/CD
