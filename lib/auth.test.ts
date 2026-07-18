import { describe, it, expect, vi } from 'vitest';
import { authenticateApiKey } from './auth';

vi.mock('@/lib/db', () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
    },
  },
}));

describe('authenticateApiKey', () => {
  it('should fail if x-api-key header is missing', async () => {
    const req = new Request('https://example.com/api', { headers: {} });
    const result = await authenticateApiKey(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Missing x-api-key header');
      expect(result.status).toBe(401);
    }
  });

  it('should fail if x-api-key header is too short', async () => {
    const req = new Request('https://example.com/api', {
      headers: { 'x-api-key': 'short' },
    });
    const result = await authenticateApiKey(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Invalid API key format');
      expect(result.status).toBe(401);
    }
  });

  it('should fail if x-api-key header is too long', async () => {
    const longKey = 'a'.repeat(129);
    const req = new Request('https://example.com/api', {
      headers: { 'x-api-key': longKey },
    });
    const result = await authenticateApiKey(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Invalid API key format');
      expect(result.status).toBe(401);
    }
  });
});
