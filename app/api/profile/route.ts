/**
 * Customer profile read/update endpoints — DELIBERATELY NOT IMPLEMENTED.
 *
 * These routes operate on `user_profiles`, which is keyed by a customer identity in
 * Supabase `auth.users`. This admin app does not authenticate as a Supabase user: it
 * authenticates against the `admin_users` table (bcrypt + a custom JWT, see
 * lib/admin-auth.ts), so the only caller identity available here is an
 * `admin_users.id`.
 *
 * Those two id spaces are unrelated — each table mints its own `gen_random_uuid()`
 * values and there is no mapping between them. Running these handlers against an
 * `admin_users.id` therefore does not fail loudly; it silently misbehaves:
 *   - GET never matched a row and fell through to a synthesized profile, returning a
 *     plausible-looking record that corresponds to no stored customer.
 *   - PUT upserted `user_profiles` with `id = <admin_users.id>`, writing a junk row
 *     into a customer table under an id that belongs to no customer.
 *
 * Returning wrong data is bad; reporting success for a write that landed in the wrong
 * place is worse. Both handlers now stop at an explicit 501 after the admin gate and
 * before any database access. The previous implementations were removed rather than
 * left unreachable; they are recoverable from git history and would need rewriting
 * against the reconciled identity anyway.
 *
 * Reconciling admin/customer identity is tracked as separate work. This is a
 * deliberate hold, not an abandoned route.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdminUser } from "@/lib/jwt-auth";

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
  return NextResponse.json(
    { error: "Not implemented: admin/customer identity reconciliation pending" },
    { status: 501 }
  );
}

function internalError(): NextResponse {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    return (await requireAdmin(request)) ?? notImplemented();
  } catch (err) {
    console.error("[GET /api/profile] Authentication failed", err);
    return internalError();
  }
}

export async function PUT(request: NextRequest) {
  try {
    return (await requireAdmin(request)) ?? notImplemented();
  } catch (err) {
    console.error("[PUT /api/profile] Authentication failed", err);
    return internalError();
  }
}
