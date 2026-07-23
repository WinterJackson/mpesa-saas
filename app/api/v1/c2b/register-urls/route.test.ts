import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { authenticateApiKey } from '@/lib/auth';
import { registerC2BUrls } from '@/lib/daraja-c2b';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@/lib/auth', () => ({ authenticateApiKey: vi.fn() }));
vi.mock('@/lib/daraja-c2b', () => ({ registerC2BUrls: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const authOk = {
  success: true as const,
  organizationId: 'org-1',
  merchant: { id: 'm-1', environment: 'live' } as never,
  apiKey: { id: 'key-1', scope: 'read_write' } as never,
};

function req() {
  return new Request('http://localhost/api/v1/c2b/register-urls', { method: 'POST' });
}

describe('POST /api/v1/c2b/register-urls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a read_only key', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({ ...authOk, apiKey: { id: 'k', scope: 'read_only' } as never });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(registerC2BUrls).not.toHaveBeenCalled();
  });

  it('registers URLs for the org environment and writes an audit log', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    vi.mocked(registerC2BUrls).mockResolvedValueOnce({ ResponseDescription: 'Success' });
    const res = await POST(req());
    expect(registerC2BUrls).toHaveBeenCalledWith({ organizationId: 'org-1', environment: 'live' });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'c2b.urls_registered' }));
    expect(res.status).toBe(200);
  });

  it('returns 502 when Daraja registration fails', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    vi.mocked(registerC2BUrls).mockRejectedValueOnce(new Error('Failed to register C2B URLs: 500'));
    const res = await POST(req());
    expect(res.status).toBe(502);
  });
});
