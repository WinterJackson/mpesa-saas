import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real next/server after() throws outside a request scope; stub it to a
// no-op so fire-and-forget email dispatch doesn't break the route under test.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: () => {},
}));
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, setLiveRequested } from '@/lib/repositories/organizations';
import { isLiveCredentialConfigured } from '@/lib/repositories/daraja-credentials';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn(), setLiveRequested: vi.fn() }));
vi.mock('@/lib/repositories/daraja-credentials', () => ({ isLiveCredentialConfigured: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function ctx(overrides: Record<string, unknown> = {}) {
  return { organization: { id: 'org-1', kycStatus: 'approved', liveApprovedAt: null, ...overrides }, membership: {}, merchant: { id: 'm-1' } };
}

describe('POST /api/merchant/go-live/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'owner' } as never });
    vi.mocked(isLiveCredentialConfigured).mockResolvedValue(true);
  });

  it('403s a developer/finance role', async () => {
    vi.mocked(getOrganizationContext).mockResolvedValueOnce(ctx() as never);
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'no', status: 403 });
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it('400s when KYC is not approved', async () => {
    vi.mocked(getOrganizationContext).mockResolvedValueOnce(ctx({ kycStatus: 'pending' }) as never);
    const res = await POST();
    expect(res.status).toBe(400);
    expect(setLiveRequested).not.toHaveBeenCalled();
  });

  it('400s when live credentials are missing', async () => {
    vi.mocked(getOrganizationContext).mockResolvedValueOnce(ctx() as never);
    vi.mocked(isLiveCredentialConfigured).mockResolvedValueOnce(false);
    const res = await POST();
    expect(res.status).toBe(400);
  });

  it('marks the request and audit-logs when eligible', async () => {
    vi.mocked(getOrganizationContext).mockResolvedValueOnce(ctx() as never);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(setLiveRequested).toHaveBeenCalledWith('org-1');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'organization.go_live_requested' }));
  });
});
