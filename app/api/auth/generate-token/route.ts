import { NextRequest, NextResponse } from "next/server";
import { generateAuthToken } from "@/lib/jwt-auth";

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.warn("Invalid JSON in request body:", parseError);
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

    // Generate JWT token for the user
    const token = await generateAuthToken(userId, userEmail);

    return NextResponse.json({
      token,
      success: true,
    });
  } catch (error) {
    console.error("Error generating JWT token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
