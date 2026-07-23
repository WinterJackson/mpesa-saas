import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/rate-limit';
import { getOrgApiRateLimit } from '@/lib/repositories/billing';

/**
 * Per-plan API rate limiting, enforced IN-ROUTE (the org is only known after
 * authentication, so this can't live in the edge proxy). The coarse IP/key
 * limiter in proxy.ts stays as the first line of defense; this adds a precise
 * per-organization quota derived from the org's subscription plan.
 *
 * Dynamic-limit design: Upstash's Ratelimit fixes its limit at construction, so
 * we memoize one limiter instance per distinct numeric limit (there are only a
 * few plan tiers). The resolved plan limit is cached in Redis (60s) to avoid a
 * DB hit per request. When Redis is not configured (local dev), everything is
 * allowed and callers skip the headers.
 */

export interface PlanRateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms when the window resets
  enforced: boolean; // false when Redis is absent (dev) — callers may skip headers
}

const PLAN_LIMIT_CACHE_TTL_S = 60;
const limiterByValue = new Map<number, Ratelimit>();

function getLimiter(limit: number): Ratelimit {
  let limiter = limiterByValue.get(limit);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, '1 m'),
      analytics: false,
      prefix: '@payswift/plan-rate-limit',
    });
    limiterByValue.set(limit, limiter);
  }
  return limiter;
}

async function resolveLimit(organizationId: string): Promise<number> {
  const cacheKey = `planlimit:${organizationId}`;
  const cached = await redis!.get<number>(cacheKey);
  if (typeof cached === 'number' && cached > 0) return cached;

  const limit = await getOrgApiRateLimit(organizationId);
  await redis!.set(cacheKey, limit, { ex: PLAN_LIMIT_CACHE_TTL_S });
  return limit;
}

/**
 * Enforces the org's plan limit for a route class (e.g. 'payments', 'payouts',
 * 'refunds', 'transactions'). Each route class gets its own sliding window so a
 * burst of reads can't starve writes. Never throws — on any internal error it
 * fails OPEN (allows the request) so a Redis blip can't take payments down.
 */
export async function enforcePlanRateLimit(
  organizationId: string,
  routeClass: string
): Promise<PlanRateLimitResult> {
  if (!redis) {
    return { ok: true, limit: 0, remaining: 0, reset: Date.now(), enforced: false };
  }

  try {
    const limit = await resolveLimit(organizationId);
    const result = await getLimiter(limit).limit(`${organizationId}:${routeClass}`);
    return {
      ok: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      enforced: true,
    };
  } catch {
    // Fail open — never let a rate-limiter outage block money movement.
    return { ok: true, limit: 0, remaining: 0, reset: Date.now(), enforced: false };
  }
}

/** X-RateLimit-* headers for a response (empty when not enforced, e.g. dev). */
export function rateLimitHeaders(result: PlanRateLimitResult): Record<string, string> {
  if (!result.enforced) return {};
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
  };
}

/** Seconds until the window resets, for a 429 Retry-After header. */
export function retryAfterSeconds(result: PlanRateLimitResult): number {
  return Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
}
