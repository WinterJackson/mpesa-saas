import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, updateMerchantForOrganization } from '@/lib/repositories/organizations';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/crypto', () => ({
  encryptSecret: vi.fn((v: string) => `enc:${v}`),
  decryptSecret: vi.fn((v: string) => v.replace('enc:', '')),
}));
vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
  updateMerchantForOrganization: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
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

  it('rejects switching to live when the org has not been admin-approved for go-live', async () => {
    vi.mocked(getOrganizationContext).mockResolvedValueOnce({
      organization: { id: 'org-1', liveApprovedAt: null },
      membership: {},
      merchant: { id: 'merchant-1' },
    } as never);
    const response = await PATCH(makeRequest({ environment: 'live' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/admin go-live approval/i);
    expect(updateMerchantForOrganization).not.toHaveBeenCalled();
  });

  it('allows switching to live once the org has been admin-approved (liveApprovedAt set)', async () => {
    vi.mocked(getOrganizationContext).mockResolvedValueOnce({
      organization: { id: 'org-1', liveApprovedAt: new Date() },
      membership: {},
      merchant: { id: 'merchant-1' },
    } as never);
    vi.mocked(updateMerchantForOrganization).mockResolvedValueOnce({ environment: 'live', webhookUrl: null, shopifyShopDomain: null, shopifyAdminAccessToken: null, shopifyWebhookSecret: null } as never);

    const response = await PATCH(makeRequest({ environment: 'live' }));
    expect(response.status).toBe(200);
    expect(updateMerchantForOrganization).toHaveBeenCalledWith('org-1', { environment: 'live' });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      actorId: 'user-1',
      action: 'organization.settings_updated',
      metadata: { fieldsChanged: ['environment'] },
    }));
  });

  it('rejects a non-HTTPS webhook URL', async () => {
    const response = await PATCH(makeRequest({ webhookUrl: 'http://insecure.example.com' }));
    expect(response.status).toBe(400);
  });

  it('rejects a webhook URL pointing at a local/private address (SSRF guard)', async () => {
    const response = await PATCH(makeRequest({ webhookUrl: 'https://169.254.169.254/latest/meta-data' }));
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toMatch(/local or private address/i);
    expect(updateMerchantForOrganization).not.toHaveBeenCalled();
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
