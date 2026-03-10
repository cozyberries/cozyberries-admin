const delhiveryConfig = {
  baseUrl: process.env.DELHIVERY_BASE_URL || "https://staging-express.delhivery.com",
  token: process.env.DELIVERY_API_KEY || "",
  warehouseName: process.env.DELHIVERY_WAREHOUSE_NAME || "",
  timeout: 15_000,
} as const;

export default delhiveryConfig;
