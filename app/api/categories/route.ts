import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest, isAdminUser } from "@/lib/jwt-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !isAdminUser(auth.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("categories")
      .select("name, slug")
      .order("name");

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch categories: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
