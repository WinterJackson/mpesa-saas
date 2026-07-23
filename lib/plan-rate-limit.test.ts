import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state shared with the mock factories — must be created via vi.hoisted
// so it exists when the (hoisted) vi.mock factories run.
const h = vi.hoisted(() => {
  const redisMock = { get: vi.fn(), set: vi.fn() };
  return {
    redisMock,
    redisRef: { current: redisMock as unknown },
    limitResult: { current: { success: true, limit: 60, remaining: 59, reset: 0 } },
  };
});

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    limit() {
      return Promise.resolve(h.limitResult.current);
    }
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  get redis() {
    return h.redisRef.current;
  },
}));

vi.mock('@/lib/repositories/billing', () => ({
  getOrgApiRateLimit: vi.fn().mockResolvedValue(60),
  DEFAULT_API_RATE_LIMIT_PER_MIN: 60,
}));

import { enforcePlanRateLimit, rateLimitHeaders, retryAfterSeconds } from './plan-rate-limit';

describe('enforcePlanRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.redisRef.current = h.redisMock;
    h.limitResult.current = { success: true, limit: 60, remaining: 59, reset: Date.now() + 30_000 };
    h.redisMock.get.mockResolvedValue(null);
    h.redisMock.set.mockResolvedValue('OK');
  });

  it('allows and reports remaining under the limit', async () => {
    const r = await enforcePlanRateLimit('org-1', 'payments');
    expect(r.ok).toBe(true);
    expect(r.enforced).toBe(true);
    expect(r.limit).toBe(60);
    expect(r.remaining).toBe(59);
  });

  it('blocks when the window is exhausted', async () => {
    h.limitResult.current = { success: false, limit: 60, remaining: 0, reset: Date.now() + 20_000 };
    const r = await enforcePlanRateLimit('org-1', 'payments');
    expect(r.ok).toBe(false);
  });

  it('uses the cached plan limit when present (no DB hit)', async () => {
    h.redisMock.get.mockResolvedValueOnce(300);
    const { getOrgApiRateLimit } = await import('@/lib/repositories/billing');
    await enforcePlanRateLimit('org-1', 'payments');
    expect(getOrgApiRateLimit).not.toHaveBeenCalled();
  });

  it('fails open (allows) when Redis is not configured', async () => {
    h.redisRef.current = null;
    const r = await enforcePlanRateLimit('org-1', 'payments');
    expect(r.ok).toBe(true);
    expect(r.enforced).toBe(false);
  });
});

describe('header helpers', () => {
  it('rateLimitHeaders emits X-RateLimit-* only when enforced', () => {
    expect(rateLimitHeaders({ ok: true, limit: 0, remaining: 0, reset: 0, enforced: false })).toEqual({});
    const hdr = rateLimitHeaders({ ok: true, limit: 60, remaining: 42, reset: 1_700_000_000_000, enforced: true });
    expect(hdr['X-RateLimit-Limit']).toBe('60');
    expect(hdr['X-RateLimit-Remaining']).toBe('42');
    expect(hdr['X-RateLimit-Reset']).toBe('1700000000');
  });

  it('retryAfterSeconds is at least 1', () => {
    expect(retryAfterSeconds({ ok: false, limit: 60, remaining: 0, reset: Date.now() - 5000, enforced: true })).toBeGreaterThanOrEqual(1);
  });
});
