import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { setSandboxCredential, setLiveCredential } from '@/lib/repositories/daraja-credentials';
import { getAccessToken } from '@/lib/daraja';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
}));

vi.mock('@/lib/repositories/daraja-credentials', () => ({
  setSandboxCredential: vi.fn(),
  setLiveCredential: vi.fn(),
}));

vi.mock('@/lib/daraja', () => ({
  getAccessToken: vi.fn(),
}));

vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

const VALID_CREDS = {
  mode: 'live',
  consumerKey: 'ck',
  consumerSecret: 'cs',
  shortcode: '174379',
  passkey: 'pk',
  callbackUrl: 'https://example.com/callback',
};

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/merchant/onboarding/payment-setup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/merchant/onboarding/payment-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: {},
      merchant: null,
    } as never);
  });

  it('returns 400 for an invalid mode', async () => {
    const response = await POST(makeRequest({ ...VALID_CREDS, mode: 'staging' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when a required field is missing', async () => {
    const { consumerKey: _omit, ...rest } = VALID_CREDS;
    void _omit;
    const response = await POST(makeRequest(rest));
    expect(response.status).toBe(400);
  });

  it('returns 400 for an invalid callbackUrl', async () => {
    const response = await POST(makeRequest({ ...VALID_CREDS, callbackUrl: 'not-a-url' }));
    expect(response.status).toBe(400);
  });

  it('saves live credentials and validates them against Safaricom', async () => {
    vi.mocked(getAccessToken).mockResolvedValueOnce('token');
    const response = await POST(makeRequest(VALID_CREDS));

    expect(setLiveCredential).toHaveBeenCalledWith('org-1', expect.objectContaining({ consumerKey: 'ck' }));
    expect(getAccessToken).toHaveBeenCalledWith('org-1', 'live');
    expect(response.status).toBe(200);
  });

  it('saves sandbox credentials when mode is sandbox', async () => {
    vi.mocked(getAccessToken).mockResolvedValueOnce('token');
    const response = await POST(makeRequest({ ...VALID_CREDS, mode: 'sandbox' }));

    expect(setSandboxCredential).toHaveBeenCalledWith('org-1', expect.anything());
    expect(response.status).toBe(200);
  });

  it('returns 502 with a clear message when Safaricom rejects the credentials', async () => {
    vi.mocked(getAccessToken).mockRejectedValueOnce(new Error('Daraja authentication failed with status 400'));
    const response = await POST(makeRequest(VALID_CREDS));
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toMatch(/could not be validated/i);
  });
});
