import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { getPackingSlipJSON } from "@/lib/delhivery/client";
import LabelPrint from "@/components/admin/LabelPrint";
import type { PackingSlipRawPackage } from "@/lib/delhivery/types";

export default async function LabelPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getSessionFromCookie();
  if (!session) redirect("/login");

  const { orderId } = await params;
  const supabase = createAdminSupabaseClient();

  const isOrderNumber = /^ORD-\d{8}-\d{6}-\d{5}$/.test(orderId);
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number, tracking_number, carrier_name")
    .eq(isOrderNumber ? "order_number" : "id", orderId)
    .single();

  if (orderErr || !order) {
    return (
      <div style={{ padding: 32, fontFamily: "sans-serif" }}>
        <h2>Order not found</h2>
        <p>The order ID <code>{orderId}</code> does not exist.</p>
      </div>
    );
  }

  if (!order.tracking_number || order.carrier_name !== "Delhivery") {
    return (
      <div style={{ padding: 32, fontFamily: "sans-serif" }}>
        <h2>No Delhivery shipment</h2>
        <p>Order <strong>{order.order_number}</strong> does not have a Delhivery waybill.</p>
      </div>
    );
  }

  const result = await getPackingSlipJSON(order.tracking_number);

  if (!result.ok || result.data.packages_found === 0) {
    return (
      <div style={{ padding: 32, fontFamily: "sans-serif" }}>
        <h2>Label not available</h2>
        <p>Could not fetch label data from Delhivery. {!result.ok && result.error}</p>
      </div>
    );
  }

  const pkg = result.data.packages[0] as PackingSlipRawPackage;

  return <LabelPrint pkg={pkg} />;
}
