/**
 * Customer address endpoints — DELIBERATELY NOT IMPLEMENTED.
 *
 * These routes operate on `user_addresses`, whose `user_id` references a customer
 * identity in Supabase `auth.users`. This admin app does not authenticate as a
 * Supabase user: it authenticates against the `admin_users` table (bcrypt + a custom
 * JWT, see lib/admin-auth.ts), so the only caller identity available here is an
 * `admin_users.id`.
 *
 * Those two id spaces are unrelated — each table mints its own `gen_random_uuid()`
 * values and there is no mapping between them. Running these handlers against an
 * `admin_users.id` therefore does not fail loudly; it silently misbehaves:
 * SELECT matches nothing and returns `[]` as though the customer had no addresses,
 * and INSERT writes an orphan row (or trips a foreign key) under a user_id that
 * belongs to no customer.
 *
 * Returning wrong data is worse than returning an error, so every handler stops at
 * an explicit 501 after the admin gate and before any database access. The previous
 * implementations were removed rather than left unreachable; they are recoverable
 * from git history and would need rewriting against the reconciled identity anyway.
 *
 * Reconciling admin/customer identity is tracked as separate work. This is a
 * deliberate hold, not an abandoned route.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdminUser } from "@/lib/jwt-auth";

const NOT_IMPLEMENTED = {
  error: "Not implemented: admin/customer identity reconciliation pending",
} as const;

/**
 * Rejects anyone who is not an authenticated admin. Returns null when the caller
 * passes, so handlers can `return gate ?? notImplemented()`.
 *
 * Any throw (for example a missing JWT_SECRET) propagates to the caller's catch,
 * which must fail closed with an error status — never a 200.
 */
async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const auth = await authenticateRequest(request);
  if (!auth.isAuthenticated || !isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function notImplemented(): NextResponse {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}

function internalError(): NextResponse {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    return (await requireAdmin(request)) ?? notImplemented();
  } catch (err) {
    console.error("[GET /api/profile/addresses] Authentication failed", err);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    return (await requireAdmin(request)) ?? notImplemented();
  } catch (err) {
    console.error("[POST /api/profile/addresses] Authentication failed", err);
    return internalError();
  }
}
