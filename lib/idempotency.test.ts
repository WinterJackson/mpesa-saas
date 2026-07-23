import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedIdempotentResponse, cacheIdempotentResponse } from './idempotency';
import { redis } from './rate-limit';
import { prisma } from '@/lib/db';

vi.mock('./rate-limit', () => ({
  redis: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    idempotencyRecord: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('Idempotency (Redis fast path + Postgres durable fallback)', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getCachedIdempotentResponse', () => {
    it('returns the Redis hit without touching Postgres, keyed by organizationId', async () => {
      const cached = { data: { success: true }, status: 201 };
      vi.mocked(redis!).get.mockResolvedValueOnce(cached);

      const result = await getCachedIdempotentResponse('idem-1', 'org-1');
      expect(redis!.get).toHaveBeenCalledWith('idempotency:org-1:idem-1');
      expect(result).toEqual(cached);
      expect(prisma.idempotencyRecord.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to Postgres on a Redis miss and re-warms Redis', async () => {
      vi.mocked(redis!).get.mockResolvedValueOnce(null);
      vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValueOnce({
        key: 'org-1:idem-1',
        status: 201,
        responseData: { success: true },
        expiresAt: new Date(Date.now() + 60_000),
      } as never);

      const result = await getCachedIdempotentResponse('idem-1', 'org-1');
      expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledWith({ where: { key: 'org-1:idem-1' } });
      expect(result).toEqual({ data: { success: true }, status: 201 });
      expect(redis!.set).toHaveBeenCalled(); // re-warm
    });

    it('ignores an expired Postgres record', async () => {
      vi.mocked(redis!).get.mockResolvedValueOnce(null);
      vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValueOnce({
        key: 'org-1:idem-1',
        status: 201,
        responseData: {},
        expiresAt: new Date(Date.now() - 1000),
      } as never);

      expect(await getCachedIdempotentResponse('idem-1', 'org-1')).toBeNull();
    });
  });

  describe('cacheIdempotentResponse', () => {
    it('writes both Redis (24h ex) and a durable Postgres upsert', async () => {
      await cacheIdempotentResponse('idem-1', 'org-1', { success: true }, 201);
      expect(redis!.set).toHaveBeenCalledWith('idempotency:org-1:idem-1', { data: { success: true }, status: 201 }, { ex: 86400 });
      expect(prisma.idempotencyRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'org-1:idem-1' } })
      );
    });

    it('still writes Postgres even if the Redis write throws', async () => {
      vi.mocked(redis!).set.mockRejectedValueOnce(new Error('redis down'));
      await cacheIdempotentResponse('idem-1', 'org-1', { success: true }, 201);
      expect(prisma.idempotencyRecord.upsert).toHaveBeenCalled();
    });
  });
});
