import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedIdempotentResponse, cacheIdempotentResponse } from './idempotency';
import { redis } from './rate-limit';

// Mock the redis instance exported from rate-limit
vi.mock('./rate-limit', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('Idempotency Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCachedIdempotentResponse', () => {
    it('returns null if redis is not configured (mocked as null)', async () => {
      vi.mocked(redis!).get.mockResolvedValueOnce(null);
      const result = await getCachedIdempotentResponse('test-key', 'merchant-1');
      expect(result).toBeNull();
      expect(redis!.get).toHaveBeenCalledWith('idempotency:merchant-1:test-key');
    });

    it('returns cached response if found', async () => {
      const mockCached = { data: { success: true }, status: 200 };
      vi.mocked(redis!).get.mockResolvedValueOnce(mockCached);
      
      const result = await getCachedIdempotentResponse('test-key', 'merchant-1');
      expect(result).toEqual(mockCached);
    });
  });

  describe('cacheIdempotentResponse', () => {
    it('caches response with 24 hour expiration', async () => {
      await cacheIdempotentResponse('test-key', 'merchant-1', { success: true }, 200);
      expect(redis!.set).toHaveBeenCalledWith(
        'idempotency:merchant-1:test-key',
        { data: { success: true }, status: 200 },
        { ex: 86400 }
      );
    });
  });
});
