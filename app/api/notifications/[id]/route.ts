import { NextResponse } from "next/server";

// PATCH: stub for marking notification as read (used by NotificationCenter)
export async function PATCH() {
  return NextResponse.json({ success: true });
}
