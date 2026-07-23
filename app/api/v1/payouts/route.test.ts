import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { authenticateApiKey } from '@/lib/auth';
import { createAndInitiatePayout } from '@/lib/payouts';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@/lib/auth', () => ({ authenticateApiKey: vi.fn() }));
vi.mock('@/lib/payouts', () => ({ createAndInitiatePayout: vi.fn() }));
vi.mock('@/lib/idempotency', () => ({
  getCachedIdempotentResponse: vi.fn().mockResolvedValue(null),
  cacheIdempotentResponse: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/v1/payouts', { method: 'POST', headers, body: JSON.stringify(body) });
}

const authOk = {
  success: true as const,
  organizationId: 'org-1',
  merchant: { id: 'm-1', environment: 'sandbox' } as never,
  apiKey: { id: 'key-1', scope: 'read_write' } as never,
};

describe('POST /api/v1/payouts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('propagates auth failure', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({ success: false, error: 'Invalid API key', status: 401 });
    const res = await POST(makeRequest({ phone: '254712345678', amount: 500 }));
    expect(res.status).toBe(401);
  });

  it('rejects a read_only key with 403', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({ ...authOk, apiKey: { id: 'key-1', scope: 'read_only' } as never });
    const res = await POST(makeRequest({ phone: '254712345678', amount: 500 }));
    expect(res.status).toBe(403);
    expect(createAndInitiatePayout).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone with 400', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    const res = await POST(makeRequest({ phone: 'nope', amount: 500 }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid commandId with 400', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    const res = await POST(makeRequest({ phone: '254712345678', amount: 500, commandId: 'Nope' }));
    expect(res.status).toBe(400);
  });

  it('initiates the payout, writes an audit log, and returns 201', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    vi.mocked(createAndInitiatePayout).mockResolvedValueOnce({
      success: true, payoutId: 'p-1', conversationId: 'AG_1', originatorConversationId: 'OC_1',
    });

    const res = await POST(makeRequest({ phone: '254712345678', amount: 500 }));
    const data = await res.json();

    expect(createAndInitiatePayout).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', merchantId: 'm-1', amount: 500 }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'payout.initiated' }));
    expect(res.status).toBe(201);
    expect(data.data.payoutId).toBe('p-1');
  });

  it('returns 502 when the gateway call fails', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    vi.mocked(createAndInitiatePayout).mockResolvedValueOnce({ success: false, error: 'gateway down', payoutId: 'p-1' });
    const res = await POST(makeRequest({ phone: '254712345678', amount: 500 }));
    expect(res.status).toBe(502);
  });
});
