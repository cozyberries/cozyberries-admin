# Bug Fixes Summary

This document summarizes all the fixes applied to address the reported issues.

## 1. Address Update Route - Clear Existing Defaults

**File:** `app/api/profile/addresses/[id]/route.ts`  
**Lines:** 38-53

**Issue:** The PUT handler was building `sanitizedUpdate` including `is_default` but wasn't clearing existing defaults, allowing multiple addresses with `is_default=true`.

**Fix:** Added logic to clear other default addresses before updating the target address:
- Check if `body.is_default === true`
- If true, run an update on all other addresses for the same user to set `is_default = false`
- Use `.neq("id", id)` to exclude the current address being updated
- Log errors server-side with a generic error message to client

**Note:** The race condition remains unless the database function approach is used (addressed in issue #2).

## 2. Address Creation Route - Atomic Default Update

**File:** `app/api/profile/addresses/route.ts`  
**Lines:** 86-127

**Issue:** The two-step default-update was vulnerable to race conditions.

**Fix:** Replaced separate update and insert operations with an atomic RPC call:
- Created a PostgreSQL function `ensure_single_default_address` (see `database/migrations/ensure_single_default_address.sql`)
- Function clears existing defaults and inserts new address in a single transaction
- Updated route to call `supabase.rpc('ensure_single_default_address', {...})`
- Added proper error handling for RPC errors
- Removed the manual update step

**Database Migration Required:** Apply `database/migrations/ensure_single_default_address.sql` to your Supabase database.

## 3. Address Creation Route - Generic Error Messages

**File:** `app/api/profile/addresses/route.ts`  
**Lines:** 120-124

**Issue:** The response was returning raw database error via `updateError.message` in `NextResponse.json`.

**Fix:**
- Changed error response to generic message: "Failed to create address"
- Added server-side logging with `console.error` that includes full error details
- Client only receives generic error message for security

## 4. ExpenseDashboard - JSON Parsing Error Handling

**File:** `components/admin/ExpenseDashboard.tsx`  
**Lines:** 64-87

**Issue:** JSON parsing calls could throw and prevent `setLoading(false)` from running, leaving component stuck in loading state.

**Fix:**
- Wrapped each `response.json()` call in separate try-catch blocks
- On parse error:
  - Log error to console
  - Set `fetchError` state with descriptive message
  - Continue execution (don't break the whole function)
- `setLoading(false)` is now guaranteed to execute after all parsing attempts
- Each parse failure is independent and doesn't affect other data loading

## 5. API Test - Setup Route Status Code

**File:** `tests/api.spec.ts`  
**Lines:** 155-161

**Issue:** Test was asserting 500 for malformed JSON but the correct status for client errors is 400.

**Fix:**
- Updated test name to reflect "malformed JSON should return 400"
- Changed assertion to `expect(response.status()).toBe(400)`
- Updated the actual route handler to catch JSON parse errors and return 400

## 6. API Test - Generate Token Route Status Code

**File:** `tests/api.spec.ts`  
**Lines:** 125-131

**Issue:** Test was asserting 500 for malformed JSON but should be 400 for invalid input.

**Fix:**
- Updated test name to reflect "malformed JSON should return 400"
- Changed assertion to `expect(response.status()).toBe(400)`
- Updated the actual route handler to catch JSON parse errors and return 400

## 7. Auth Test - Flaky Loading State Test

**File:** `tests/auth.spec.ts`  
**Lines:** 104-113

**Issue:** The 1000ms `waitFor` timeout was flaky and unreliable.

**Fix:**
- Replaced brittle timeout with network request interception
- Added `page.route('**/auth/v1/token**', ...)` to intercept auth requests
- Added 500ms delay in the route handler to ensure loading state is visible
- Changed from `waitFor` to `expect(...).toBeVisible()` for more reliable assertion
- Route interception is set up before clicking the sign-in button

## 8. API Handlers - JSON Parse Error Handling

**Files:** 
- `app/api/auth/generate-token/route.ts` (lines 5-17)
- `app/api/setup/route.ts` (lines 8-28)

**Issue:** Handlers didn't catch JSON parse errors, causing 500 errors instead of 400.

**Fix:**
- Wrapped `await request.json()` in try-catch block
- On `SyntaxError` or parse failure:
  - Log error to console
  - Return 400 status with "Invalid JSON in request body" message
- Continue with normal validation after successful parsing

## Additional Files Created

### database/migrations/ensure_single_default_address.sql
PostgreSQL function that atomically handles address creation with default logic:
- Clears existing defaults if `is_default` is true
- Inserts new address
- Returns the created address
- All in one transaction

### database/README.md
Documentation for applying database migrations:
- Instructions for Supabase Dashboard
- Instructions for Supabase CLI
- Description of each migration
- Important notes about table requirements

## Testing Recommendations

1. **Address Routes:**
   - Test creating multiple default addresses simultaneously
   - Test updating an address to be default while another is already default
   - Verify only one default address exists per user

2. **API Error Handling:**
   - Send malformed JSON to `/api/auth/generate-token` and verify 400 response
   - Send malformed JSON to `/api/setup` and verify 400 response

3. **ExpenseDashboard:**
   - Mock API to return invalid JSON
   - Verify component doesn't get stuck in loading state
   - Check error messages are displayed

4. **Auth Tests:**
   - Run the loading state test multiple times to verify it's no longer flaky
   - Verify the route interception doesn't break normal auth flow

## Migration Steps

1. Apply the SQL migration to your Supabase database:
   ```bash
   # Via Supabase Dashboard: Copy contents of ensure_single_default_address.sql and run in SQL Editor
   # OR via Supabase CLI:
   supabase db execute --file database/migrations/ensure_single_default_address.sql
   ```

2. Deploy the updated code

3. Run the test suite to verify all fixes work correctly
