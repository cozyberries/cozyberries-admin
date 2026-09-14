/**
 * Combined customer profile + addresses endpoint — DELIBERATELY NOT IMPLEMENTED.
 *
 * This route reads `user_profiles` (and would read `user_addresses`), both of which
 * are keyed by a customer identity in Supabase `auth.users`. This admin app does not
 * authenticate as a Supabase user: it authenticates against the `admin_users` table
 * (bcrypt + a custom JWT, see lib/admin-auth.ts), so the only caller identity
 * available here is an `admin_users.id`.
 *
 * Those two id spaces are unrelated — each table mints its own `gen_random_uuid()`
 * values and there is no mapping between them. Looking up `user_profiles` by an
 * `admin_users.id` never matches, so the handler used to fall through to its
 * synthesized-profile branch and return a plausible-looking record that corresponds
 * to no stored customer. Returning wrong data is worse than returning an error, so
 * the handler now stops at an explicit 501 after the admin gate and before any
 * database access.
 *
 * The previous implementation was removed rather than left unreachable; it is
 * recoverable from git history and would need rewriting against the reconciled
 * identity anyway.
 *
 * Reconciling admin/customer identity is tracked as separate work. This is a
 * deliberate hold, not an abandoned route.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdminUser } from "@/lib/jwt-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !isAdminUser(auth.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Not implemented: admin/customer identity reconciliation pending" },
      { status: 501 }
    );
  } catch (err) {
    // Must not fall back to a success status: a throw here (for example a missing
    // JWT_SECRET) means the auth check never completed.
    console.error("[GET /api/profile/combined] Authentication failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
