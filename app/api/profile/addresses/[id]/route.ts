/**
 * Customer address update/delete endpoints — DELIBERATELY NOT IMPLEMENTED.
 *
 * These routes operate on `user_addresses`, whose `user_id` references a customer
 * identity in Supabase `auth.users`. This admin app does not authenticate as a
 * Supabase user: it authenticates against the `admin_users` table (bcrypt + a custom
 * JWT, see lib/admin-auth.ts), so the only caller identity available here is an
 * `admin_users.id`.
 *
 * Those two id spaces are unrelated — each table mints its own `gen_random_uuid()`
 * values and there is no mapping between them. Every query here was scoped by
 * `user_id = <admin_users.id>`, which matches no row, so the handlers did not fail
 * loudly — they reported success for writes that silently affected nothing. PUT went
 * as far as echoing the caller's requested values back as though they had been saved.
 * Reporting success for a write that did not happen is the worst of the available
 * failure modes, so both handlers now stop at an explicit 501 after the admin gate
 * and before any database access.
 *
 * The previous implementations were removed rather than left unreachable; they are
 * recoverable from git history and would need rewriting against the reconciled
 * identity anyway.
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

export async function PUT(request: NextRequest) {
  try {
    return (await requireAdmin(request)) ?? notImplemented();
  } catch (err) {
    console.error("[PUT /api/profile/addresses/[id]] Authentication failed", err);
    return internalError();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return (await requireAdmin(request)) ?? notImplemented();
  } catch (err) {
    console.error(
      "[DELETE /api/profile/addresses/[id]] Authentication failed",
      err
    );
    return internalError();
  }
}
