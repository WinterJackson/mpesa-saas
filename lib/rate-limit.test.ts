import { describe, it, expect, vi } from 'vitest';
import { paymentInitiateRateLimit, paymentStatusRateLimit } from './rate-limit';

vi.mock('@upstash/redis', () => {
  return {
    Redis: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

vi.mock('@upstash/ratelimit', () => {
  const mockLimit = vi.fn().mockResolvedValue({ success: true, pending: Promise.resolve() });
  return {
    Ratelimit: Object.assign(vi.fn().mockImplementation(() => ({
      limit: mockLimit,
    })), {
      slidingWindow: vi.fn((reqs, win) => `${reqs} per ${win}`),
    })
  };
});

describe('rate-limit', () => {
  it('exports paymentInitiateRateLimit which has limit method', async () => {
    const result = await paymentInitiateRateLimit.limit('test_ip');
    expect(result.success).toBe(true);
  });
  
  it('exports paymentStatusRateLimit which has limit method', async () => {
    const result = await paymentStatusRateLimit.limit('test_ip');
    expect(result.success).toBe(true);
  });
});
