/**
 * Upserts a QStash schedule that POSTs to the Delhivery webhook processor URL.
 *
 * Default cadence: every 4 hours between 08:00 and 20:00 (8 AM–8 PM) in `Asia/Kolkata`.
 * Cron: minute 0 at hours 8, 12, 16, 20 — i.e. 8:00, 12:00, 16:00, 20:00.
 * Override with env `QSTASH_PROCESSOR_CRON` (full string, supports `CRON_TZ=...` per Upstash).
 *
 * Requires QSTASH_URL, QSTASH_TOKEN, and either QSTASH_DELHIVERY_PROCESSOR_URL or NEXT_PUBLIC_SITE_URL.
 *
 * @see https://upstash.com/docs/qstash/features/schedules
 * @see https://upstash.com/docs/qstash/features/schedules#timezones
 */
import { Client } from "@upstash/qstash";

const SCHEDULE_ID = "delhivery-webhook-processor";

/** 8 AM–8 PM window, every 4 hours (IST). Change timezone or hours via QSTASH_PROCESSOR_CRON. */
const DEFAULT_PROCESSOR_CRON = "CRON_TZ=Asia/Kolkata 0 8,12,16,20 * * *";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function main(): void {
  const baseUrl = requireEnv("QSTASH_URL").replace(/\/$/, "");
  const token = requireEnv("QSTASH_TOKEN");

  const fromExplicit = process.env.QSTASH_DELHIVERY_PROCESSOR_URL?.trim();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const destination =
    fromExplicit ||
    (site ? `${site}/api/internal/webhooks/delhivery/process` : undefined);

  if (!destination) {
    console.error(
      "Set QSTASH_DELHIVERY_PROCESSOR_URL or NEXT_PUBLIC_SITE_URL to the public POST URL of the processor route."
    );
    process.exit(1);
  }

  const cron = process.env.QSTASH_PROCESSOR_CRON?.trim() || DEFAULT_PROCESSOR_CRON;

  const client = new Client({ baseUrl, token });

  void client.schedules
    .create({
      scheduleId: SCHEDULE_ID,
      destination,
      cron,
      method: "POST",
      body: JSON.stringify({ source: "qstash-schedule" }),
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((res) => {
      console.log("QStash schedule upserted:", res.scheduleId ?? SCHEDULE_ID);
      console.log("Cron:", cron);
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}

main();
