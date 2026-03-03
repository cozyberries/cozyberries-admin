import { Redis } from '@upstash/redis';

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

let _redis: Redis | null = null;
function redis(): Redis | null {
  if (_redis === null) _redis = getRedisClient();
  return _redis;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Simple fixed-window rate limiter using Upstash Redis.
 * @param key - Unique key for the rate limit bucket (e.g., "login:192.168.1.1")
 * @param maxAttempts - Maximum attempts allowed within the window
 * @param windowSeconds - Time window in seconds
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const client = redis();
  if (!client) {
    return { allowed: true, remaining: maxAttempts };
  }
  try {
    const windowKey = `ratelimit:${key}`;

    // Atomic pipeline: INCR + EXPIRE together to avoid race condition
    const pipeline = client.pipeline();
    pipeline.incr(windowKey);
    pipeline.expire(windowKey, windowSeconds);
    const [count] = await pipeline.exec<[number, number]>();

    if (count > maxAttempts) {
      const ttl = await client.ttl(windowKey);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining: maxAttempts - count,
    };
  } catch (error) {
    // If Redis is unavailable, allow the request (fail-open)
    console.error('Rate limit check failed:', error);
    return { allowed: true, remaining: maxAttempts };
  }
}

/**
 * Reset rate limit counter for a key (e.g., on successful login).
 */
export async function resetRateLimit(key: string): Promise<void> {
  const client = redis();
  if (!client) return;
  try {
    await client.del(`ratelimit:${key}`);
  } catch (error) {
    console.error('Rate limit reset failed:', error);
  }
}
