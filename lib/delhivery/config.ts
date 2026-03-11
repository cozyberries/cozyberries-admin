const baseUrl = process.env.DELHIVERY_BASE_URL;
const token = process.env.DELHIVERY_API_KEY ?? process.env.DELIVERY_API_KEY ?? "";
const warehouseName = process.env.DELHIVERY_WAREHOUSE_NAME ?? "";

function validateConfig(): void {
  const missing: string[] = [];
  if (!baseUrl?.trim()) missing.push("DELHIVERY_BASE_URL");
  if (!token?.trim()) missing.push("DELHIVERY_API_KEY or DELIVERY_API_KEY");
  if (missing.length) {
    throw new Error(`Delhivery config missing required env: ${missing.join(", ")}`);
  }
}

validateConfig();

const delhiveryConfig = {
  baseUrl: baseUrl!.trim(),
  token: token.trim(),
  warehouseName: warehouseName.trim(),
  timeout: 15_000,
} as const;

export default delhiveryConfig;
