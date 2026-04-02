import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { processWebhookEventBatch } from "@/lib/services/webhook-processor";

export const runtime = "nodejs";

const JOB_TIMEOUT_MS = 20_000;
const MAX_JOB_AGE_MS = 5 * 60 * 1000;

function constantTimeEqual(provided: string, expected: string): boolean {
  try {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
      const normalizedProvided = Buffer.alloc(expectedBuffer.length);
      providedBuffer.copy(
        normalizedProvided,
        0,
        0,
        Math.min(providedBuffer.length, expectedBuffer.length)
      );
      timingSafeEqual(normalizedProvided, expectedBuffer);
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function isFreshJobTimestamp(jobTsHeader: string | null): boolean {
  if (!jobTsHeader) {
    return false;
  }

  const timestamp = Number.parseInt(jobTsHeader, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Math.abs(Date.now() - timestamp) <= MAX_JOB_AGE_MS;
}

function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

function createJobSignature(jobTs: string, pathname: string, secret: string): string {
  return createHmac("sha256", secret).update(`${jobTs}:${pathname}`).digest("hex");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const authorizationToken = getBearerToken(request.headers.get("authorization"));
  const cronSecret = process.env.CRON_SECRET?.trim();

  const hasValidCronAuth =
    isVercelCron &&
    Boolean(cronSecret) &&
    Boolean(authorizationToken) &&
    constantTimeEqual(authorizationToken ?? "", cronSecret ?? "");

  if (!hasValidCronAuth) {
    if (isVercelCron) {
      if (!cronSecret) {
        console.error("CRON_SECRET is not configured");
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "CRON_SECRET_MISSING",
              message: "Secure cron auth is not configured",
            },
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid cron authorization",
          },
        },
        { status: 401 }
      );
    }

    const providedTokenHeader = request.headers.get("x-internal-job-token");
    if (providedTokenHeader === null) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Missing internal job token",
          },
        },
        { status: 401 }
      );
    }

    const expectedToken = process.env.INTERNAL_JOB_TOKEN?.trim();
    if (!expectedToken) {
      console.error("INTERNAL_JOB_TOKEN is not configured");
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INTERNAL_JOB_TOKEN_MISSING",
            message: "Internal worker is not configured",
          },
        },
        { status: 500 }
      );
    }

    const providedToken = providedTokenHeader.trim();
    if (!constantTimeEqual(providedToken, expectedToken)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid internal job token",
          },
        },
        { status: 401 }
      );
    }

    const jobTs = request.headers.get("x-job-ts");
    if (!jobTs) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "Missing x-job-ts header",
          },
        },
        { status: 400 }
      );
    }

    if (!isFreshJobTimestamp(jobTs)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "x-job-ts is invalid or expired",
          },
        },
        { status: 400 }
      );
    }

    const providedSignature = request.headers.get("x-job-sig")?.trim() ?? "";
    if (!providedSignature) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "Missing x-job-sig header",
          },
        },
        { status: 400 }
      );
    }

    const expectedSignature = createJobSignature(jobTs, request.nextUrl.pathname, expectedToken);
    if (!constantTimeEqual(providedSignature, expectedSignature)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid request signature",
          },
        },
        { status: 401 }
      );
    }
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("processor_timeout"));
    }, JOB_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([processWebhookEventBatch(), timeoutPromise]);
    return NextResponse.json(
      {
        ok: true,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("internal webhook processor failed", message);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: message === "processor_timeout" ? "PROCESSOR_TIMEOUT" : "PROCESSOR_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
