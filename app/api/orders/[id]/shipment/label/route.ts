import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { authenticateRequest } from "@/lib/jwt-auth";
import { getPackingSlip } from "@/lib/delhivery/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !auth.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
    const { id: orderId } = await params;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("tracking_number, carrier_name")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.tracking_number || order.carrier_name !== "Delhivery") {
      return NextResponse.json(
        { error: "No Delhivery shipment found for this order" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const pdfSizeParam = searchParams.get("pdf_size")?.trim();
    const allowedPdfSize = new Set(["A4", "4R"]);
    const pdfSize = allowedPdfSize.has(pdfSizeParam ?? "") ? (pdfSizeParam as "A4" | "4R") : "A4";

    const result = await getPackingSlip(order.tracking_number, pdfSize);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Delhivery API error: ${result.error}` },
        { status: result.statusCode || 502 }
      );
    }

    const resp = result.data;
    const packages = resp.packages;
    if (!Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json(
        { error: "No label found for this waybill" },
        { status: 404 }
      );
    }

    const pkg = packages[0];
    return NextResponse.json({
      success: true,
      waybill: pkg.wbn,
      pdf_download_link: pkg.pdf_download_link || null,
      packages_found: resp.packages_found,
    });
  } catch (err) {
    console.error("GET /api/orders/[id]/shipment/label error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
