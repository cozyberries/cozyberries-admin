# Key Code Changes - Before and After

This document shows the critical code changes made to fix the reported issues.

## 1. Address Update Route - Default Clearing

### Before
```typescript
// Lines 22-44 in app/api/profile/addresses/[id]/route.ts
const { id } = await params;
const body = await request.json();

// Whitelist permitted fields to prevent mass-assignment
const allowedFields = ["street", "city", "state", "zip", "country", "phone", "address_line_1", "address_line_2", "postal_code", "address_type", "label", "full_name", "is_default"];
const sanitizedUpdate: Record<string, any> = {
  updated_at: new Date().toISOString(),
};

// Only include allowed fields from the request body
for (const field of allowedFields) {
  if (field in body) {
    sanitizedUpdate[field] = body[field];
  }
}

const { data, error } = await supabase
  .from("user_addresses")
  .update(sanitizedUpdate)
  .eq("id", id)
  .eq("user_id", user.id)
  .select()
  .single();
```

### After
```typescript
// Lines 22-61 in app/api/profile/addresses/[id]/route.ts
const { id } = await params;
const body = await request.json();

// Whitelist permitted fields to prevent mass-assignment
const allowedFields = ["street", "city", "state", "zip", "country", "phone", "address_line_1", "address_line_2", "postal_code", "address_type", "label", "full_name", "is_default"];
const sanitizedUpdate: Record<string, any> = {
  updated_at: new Date().toISOString(),
};

// Only include allowed fields from the request body
for (const field of allowedFields) {
  if (field in body) {
    sanitizedUpdate[field] = body[field];
  }
}

// If setting this address as default, clear other defaults first
if (body.is_default === true) {
  const { error: clearError } = await supabase
    .from("user_addresses")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .neq("id", id);

  if (clearError) {
    console.error("Failed to clear existing defaults:", clearError);
    return NextResponse.json(
      { error: "Failed to update defaults" },
      { status: 500 }
    );
  }
}

const { data, error } = await supabase
  .from("user_addresses")
  .update(sanitizedUpdate)
  .eq("id", id)
  .eq("user_id", user.id)
  .select()
  .single();
```

**Key Changes:**
- Added check for `body.is_default === true`
- Clear other defaults using `.neq("id", id)` to exclude current address
- Log full error server-side, return generic message to client

---

## 2. Address Creation Route - Atomic Operation

### Before
```typescript
// Lines 86-120 in app/api/profile/addresses/route.ts
// If setting this address as default, unset all other defaults first
if (body.is_default === true) {
  const { error: updateError } = await supabase
    .from("user_addresses")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .eq("is_default", true);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update existing defaults: ${updateError.message}` },
      { status: 500 }
    );
  }
}

const { data, error } = await supabase
  .from("user_addresses")
  .insert({
    user_id: user.id,
    address_type: body.address_type ?? "home",
    label: body.label ?? null,
    full_name: body.full_name ?? null,
    phone: body.phone ?? null,
    address_line_1: body.address_line_1,
    address_line_2: body.address_line_2 ?? null,
    city: body.city,
    state: body.state,
    postal_code: body.postal_code,
    country: body.country ?? "India",
    is_default: body.is_default ?? false,
    is_active: true,
  })
  .select()
  .single();
```

### After
```typescript
// Lines 86-129 in app/api/profile/addresses/route.ts
// Use RPC to atomically handle default address logic
const addressData = {
  user_id: user.id,
  address_type: body.address_type ?? "home",
  label: body.label ?? null,
  full_name: body.full_name ?? null,
  phone: body.phone ?? null,
  address_line_1: body.address_line_1,
  address_line_2: body.address_line_2 ?? null,
  city: body.city,
  state: body.state,
  postal_code: body.postal_code,
  country: body.country ?? "India",
  is_default: body.is_default ?? false,
  is_active: true,
};

const { data, error } = await supabase
  .rpc('ensure_single_default_address', {
    p_user_id: user.id,
    p_address_type: addressData.address_type,
    p_label: addressData.label,
    p_full_name: addressData.full_name,
    p_phone: addressData.phone,
    p_address_line_1: addressData.address_line_1,
    p_address_line_2: addressData.address_line_2,
    p_city: addressData.city,
    p_state: addressData.state,
    p_postal_code: addressData.postal_code,
    p_country: addressData.country,
    p_is_default: addressData.is_default,
    p_is_active: addressData.is_active,
  });

if (error) {
  console.error("Failed to create address via RPC:", error);
  return NextResponse.json(
    { error: "Failed to create address" },
    { status: 500 }
  );
}

// RPC returns an array with one row, extract it
const newAddress = Array.isArray(data) && data.length > 0 ? data[0] : data;

return NextResponse.json(newAddress, { status: 201 });
```

**Key Changes:**
- Removed separate update and insert operations
- Added RPC call to `ensure_single_default_address` 
- Atomic operation prevents race conditions
- Generic error message to client, detailed logging server-side
- Extract first row from RPC result array

---

## 3. ExpenseDashboard - Error Handling

### Before
```typescript
// Lines 64-78 in components/admin/ExpenseDashboard.tsx
if (summaryResponse?.ok) {
  const summaryData = await summaryResponse.json();
  setSummary(summaryData);
}

if (expensesResponse?.ok) {
  const expensesData = await expensesResponse.json();
  setRecentExpenses(expensesData.expenses || []);
}

if ((!summaryResponse || !summaryResponse.ok) || (!expensesResponse || !expensesResponse.ok)) {
  setFetchError("Failed to load expenses. Check that you're signed in as an admin and the API is available.");
}

setLoading(false);
```

### After
```typescript
// Lines 64-92 in components/admin/ExpenseDashboard.tsx
try {
  if (summaryResponse?.ok) {
    const summaryData = await summaryResponse.json();
    setSummary(summaryData);
  }
} catch (parseError) {
  console.error("Failed to parse summary response:", parseError);
  setFetchError("Failed to load expense summary. The data format may be invalid.");
}

try {
  if (expensesResponse?.ok) {
    const expensesData = await expensesResponse.json();
    setRecentExpenses(expensesData.expenses || []);
  }
} catch (parseError) {
  console.error("Failed to parse expenses response:", parseError);
  if (!fetchError) {
    setFetchError("Failed to load recent expenses. The data format may be invalid.");
  }
}

if ((!summaryResponse || !summaryResponse.ok) || (!expensesResponse || !expensesResponse.ok)) {
  if (!fetchError) {
    setFetchError("Failed to load expenses. Check that you're signed in as an admin and the API is available.");
  }
}

setLoading(false);
```

**Key Changes:**
- Each JSON parsing wrapped in separate try-catch
- Errors logged to console
- `fetchError` state set with descriptive messages
- `setLoading(false)` always executes
- Failures are independent

---

## 4. API Handler - JSON Parse Error

### Before (Generate Token)
```typescript
// Lines 4-7 in app/api/auth/generate-token/route.ts
export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    // ...
  } catch (error) {
    console.error("Error generating JWT token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
```

### After (Generate Token)
```typescript
// Lines 4-29 in app/api/auth/generate-token/route.ts
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Invalid JSON in request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { userId, userEmail } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    // ...
  } catch (error) {
    console.error("Error generating JWT token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
```

**Key Changes:**
- Inner try-catch for JSON parsing
- Returns 400 for invalid JSON (not 500)
- Logs parse error
- Continues with normal validation after successful parse

---

## 5. Auth Test - Reliable Loading State

### Before
```typescript
// Lines 104-113 in tests/auth.spec.ts
test('Sign In button should show loading state during submission', async ({ page }) => {
  await page.getByLabel(/email address/i).fill('wrong@email.com');
  await page.getByLabel(/password/i).fill('wrongpassword');

  const signInBtn = page.getByRole('button', { name: /^sign in$/i });
  await signInBtn.click();

  // Wait for transient "Signing in..." text with short timeout to catch loading state
  await page.getByText('Signing in...').waitFor({ state: 'visible', timeout: 1000 });
});
```

### After
```typescript
// Lines 104-116 in tests/auth.spec.ts
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
```

**Key Changes:**
- Added `page.route()` to intercept auth requests
- 500ms delay ensures loading state is visible
- Removed brittle `waitFor` with timeout
- Use reliable `expect(...).toBeVisible()`
- Route interception set up before interaction

---

## Summary of Pattern Changes

1. **Error Messages**: Raw errors logged server-side, generic messages sent to client
2. **Atomic Operations**: Race conditions fixed with database-level transactions
3. **Error Handling**: Try-catch blocks ensure `setLoading(false)` always runs
4. **Status Codes**: JSON parse errors return 400 (not 500)
5. **Test Reliability**: Network interception instead of brittle timeouts
