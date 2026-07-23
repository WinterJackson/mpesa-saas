import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from './route';
import { auth } from '@clerk/nextjs/server';
import { isLiveModeConfigured } from '@/lib/daraja';
import { getOrganizationContext, updateMerchantForOrganization } from '@/lib/repositories/organizations';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/daraja', () => ({ isLiveModeConfigured: vi.fn() }));
vi.mock('@/lib/crypto', () => ({
  encryptSecret: vi.fn((v: string) => `enc:${v}`),
  decryptSecret: vi.fn((v: string) => v.replace('enc:', '')),
}));
vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
  updateMerchantForOrganization: vi.fn(),
}));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/merchant/settings', { method: 'PATCH', body: JSON.stringify(body) });
}

describe('PATCH /api/merchant/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: {},
      merchant: { id: 'merchant-1' },
    } as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const response = await PATCH(makeRequest({ environment: 'sandbox' }));
    expect(response.status).toBe(401);
  });

  it('returns 404 when the organization/merchant cannot be resolved', async () => {
    vi.mocked(getOrganizationContext).mockResolvedValueOnce(null);
    const response = await PATCH(makeRequest({ environment: 'sandbox' }));
    expect(response.status).toBe(404);
  });

  it('rejects switching to live when the organization has no live Daraja credentials configured', async () => {
    vi.mocked(isLiveModeConfigured).mockResolvedValueOnce(false);
    const response = await PATCH(makeRequest({ environment: 'live' }));
    const data = await response.json();

    expect(isLiveModeConfigured).toHaveBeenCalledWith('org-1');
    expect(response.status).toBe(400);
    expect(data.error).toMatch(/not yet configured for your organization/i);
    expect(updateMerchantForOrganization).not.toHaveBeenCalled();
  });

  it('allows switching to live once the organization has live credentials configured', async () => {
    vi.mocked(isLiveModeConfigured).mockResolvedValueOnce(true);
    vi.mocked(updateMerchantForOrganization).mockResolvedValueOnce({ environment: 'live', webhookUrl: null, shopifyShopDomain: null, shopifyAdminAccessToken: null, shopifyWebhookSecret: null } as never);

    const response = await PATCH(makeRequest({ environment: 'live' }));
    expect(response.status).toBe(200);
    expect(updateMerchantForOrganization).toHaveBeenCalledWith('org-1', { environment: 'live' });
  });

  it('rejects a non-HTTPS webhook URL', async () => {
    const response = await PATCH(makeRequest({ webhookUrl: 'http://insecure.example.com' }));
    expect(response.status).toBe(400);
  });

  it('rejects a Shopify domain not ending in .myshopify.com', async () => {
    const response = await PATCH(makeRequest({ shopifyShopDomain: 'not-shopify.com' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when no recognized fields are provided', async () => {
    const response = await PATCH(makeRequest({}));
    expect(response.status).toBe(400);
  });
});
