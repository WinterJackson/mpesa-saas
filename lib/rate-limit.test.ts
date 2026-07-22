import { describe, it, expect, vi } from 'vitest';
import { checkIdempotency } from './rate-limit';

vi.mock('@upstash/redis', () => {
  return {
    Redis: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

vi.mock('@upstash/ratelimit', () => {
  return {
    Ratelimit: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockResolvedValue({ success: true, pending: Promise.resolve() }),
    })),
  };
});

describe('rate-limit', () => {
  it('checkIdempotency returns true when set is OK', async () => {
    const result = await checkIdempotency('test_key');
    expect(result).toBe(true);
  });
});
