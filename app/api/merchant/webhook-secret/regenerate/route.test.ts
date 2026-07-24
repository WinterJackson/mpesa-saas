import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real next/server after() throws outside a request scope; stub it to a
// no-op so fire-and-forget email dispatch doesn't break the route under test.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: () => {},
}));
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, updateMerchantForOrganization } from '@/lib/repositories/organizations';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/crypto', () => ({
  encryptSecret: vi.fn((v: string) => `enc:${v}`),
}));
vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
  updateMerchantForOrganization: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

describe('POST /api/merchant/webhook-secret/regenerate', () => {
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
    const response = await POST();
    expect(response.status).toBe(401);
  });

  it('returns 404 when the organization/merchant cannot be resolved', async () => {
    vi.mocked(getOrganizationContext).mockResolvedValueOnce(null);
    const response = await POST();
    expect(response.status).toBe(404);
  });

  it('resolves the organization via getOrganizationContext rather than Merchant.clerkUserId, so any teammate (not just the org creator) can rotate the secret', async () => {
    // A teammate who did not create the Merchant record still has userId
    // 'user-1' matched via their Membership row, not Merchant.clerkUserId.
    const response = await POST();
    expect(response.status).toBe(200);
    expect(getOrganizationContext).toHaveBeenCalledWith('user-1', null);
  });

  it('scopes the update through updateMerchantForOrganization and writes an audit log entry', async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(typeof data.data.secret).toBe('string');
    expect(data.data.secret.startsWith('whsec_')).toBe(true);

    expect(updateMerchantForOrganization).toHaveBeenCalledWith('org-1', {
      webhookSecret: `enc:${data.data.secret}`,
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      actorId: 'user-1',
      action: 'webhook_secret.rotated',
    }));
  });
});
