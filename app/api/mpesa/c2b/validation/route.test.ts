import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { findOrgContextByShortcode } from '@/lib/repositories/daraja-credentials';

vi.mock('@/lib/repositories/daraja-credentials', () => ({ findOrgContextByShortcode: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function req(body: unknown) {
  return new Request('http://localhost/api/mpesa/c2b/validation', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/mpesa/c2b/validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts payments to a recognized shortcode', async () => {
    vi.mocked(findOrgContextByShortcode).mockResolvedValueOnce({ organizationId: 'org-1', merchantId: 'm-1', environment: 'live' });
    const res = await POST(req({ BusinessShortCode: '600100', TransID: 'X' }));
    const data = await res.json();
    expect(data.ResultCode).toBe(0);
  });

  it('rejects payments to an unknown shortcode', async () => {
    vi.mocked(findOrgContextByShortcode).mockResolvedValueOnce(null);
    const res = await POST(req({ BusinessShortCode: '999999', TransID: 'X' }));
    const data = await res.json();
    expect(data.ResultCode).toBe('C2B00012');
  });

  it('accepts (fails open) when the payload is missing a shortcode', async () => {
    const res = await POST(req({ TransID: 'X' }));
    const data = await res.json();
    expect(data.ResultCode).toBe(0);
    expect(findOrgContextByShortcode).not.toHaveBeenCalled();
  });
});
