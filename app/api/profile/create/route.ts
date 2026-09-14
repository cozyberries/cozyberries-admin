/**
 * Customer profile bootstrap endpoint — DELIBERATELY NOT IMPLEMENTED.
 *
 * This route upserts into `user_profiles`, which is keyed by a customer identity in
 * Supabase `auth.users`. This admin app does not authenticate as a Supabase user: it
 * authenticates against the `admin_users` table (bcrypt + a custom JWT, see
 * lib/admin-auth.ts), so the only caller identity available here is an
 * `admin_users.id`.
 *
 * Those two id spaces are unrelated — each table mints its own `gen_random_uuid()`
 * values and there is no mapping between them. The previous implementation therefore
 * wrote a junk row into a customer table: `id = <admin_users.id>` and, because it
 * copied the caller's role off the token, `role = 'admin'`. It never failed loudly.
 *
 * The handler now stops at an explicit 501 after the admin gate and before any
 * database access. The previous implementation was removed rather than left
 * unreachable; it is recoverable from git history.
 *
 * Note for whoever picks up the identity work: this route has no callers anywhere in
 * the repository. Its original comment says it was invoked by the Supabase auth
 * provider after sign-in, but this app never creates a Supabase session, so that call
 * path does not exist. Deleting it outright is probably better than reviving it.
 *
 * Reconciling admin/customer identity is tracked as separate work. This is a
 * deliberate hold, not an abandoned route.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdminUser } from "@/lib/jwt-auth";

export async function POST(request: NextRequest) {
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
    console.error("[POST /api/profile/create] Authentication failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
