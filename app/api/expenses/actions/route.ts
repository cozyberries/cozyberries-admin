import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request using JWT
    const auth = await authenticateRequest(request);

    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const body = await request.json();

    const { action, expense_ids, status, rejected_reason } = body;

    if (!action || !expense_ids || !Array.isArray(expense_ids)) {
      return NextResponse.json(
        { error: "Action and expense_ids are required" },
        { status: 400 }
      );
    }

    let updateData: any = {};

    switch (action) {
      case "approve":
        updateData = {
          status: "approved",
          approved_by: auth.userId,
          approved_at: new Date().toISOString(),
          rejected_reason: null,
        };
        break;

      case "reject":
        if (!rejected_reason) {
          return NextResponse.json(
            { error: "Rejection reason is required" },
            { status: 400 }
          );
        }
        updateData = {
          status: "rejected",
          rejected_reason: rejected_reason,
          approved_by: auth.userId,
          approved_at: new Date().toISOString(),
        };
        break;

      case "mark_paid":
        updateData = {
          status: "paid",
        };
        break;

      case "cancel":
        updateData = {
          status: "cancelled",
        };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("expenses")
      .update(updateData)
      .in("id", expense_ids)
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: `Failed to update expenses: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Successfully ${action}d ${data.length} expenses`,
      updated_expenses: data,
    });
  } catch (error) {
    console.error("Error performing bulk action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
