import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-auth';
import { findOrganizationById, approveGoLive } from '@/lib/repositories/organizations';
import { isLiveCredentialConfigured } from '@/lib/repositories/daraja-credentials';
import { getAccessToken } from '@/lib/daraja';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ findOrganizationById: vi.fn(), approveGoLive: vi.fn() }));
vi.mock('@/lib/repositories/daraja-credentials', () => ({ isLiveCredentialConfigured: vi.fn() }));
vi.mock('@/lib/daraja', () => ({ getAccessToken: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request('http://localhost/api/admin/organizations/org-1/go-live', { method: 'POST' });
const approvedOrg = { id: 'org-1', kycStatus: 'approved', liveApprovedAt: null };

describe('POST /api/admin/organizations/[id]/go-live', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'admin-1' } as never);
    vi.mocked(requireAdmin).mockResolvedValue({ allowed: true, admin: { id: 'a', clerkUserId: 'admin-1', role: 'superadmin', createdAt: new Date() } });
    vi.mocked(isLiveCredentialConfigured).mockResolvedValue(true);
  });

  it('requires superadmin', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: false, error: 'no', status: 403 });
    const res = await POST(req(), ctx('org-1'));
    expect(res.status).toBe(403);
    expect(requireAdmin).toHaveBeenCalledWith('admin-1', ['superadmin']);
  });

  it('400s when KYC is not approved', async () => {
    vi.mocked(findOrganizationById).mockResolvedValueOnce({ ...approvedOrg, kycStatus: 'pending' } as never);
    const res = await POST(req(), ctx('org-1'));
    expect(res.status).toBe(400);
  });

  it('502s when live credentials fail Safaricom validation', async () => {
    vi.mocked(findOrganizationById).mockResolvedValueOnce(approvedOrg as never);
    vi.mocked(getAccessToken).mockRejectedValueOnce(new Error('Could not authenticate with the payment gateway.'));
    const res = await POST(req(), ctx('org-1'));
    expect(res.status).toBe(502);
    expect(approveGoLive).not.toHaveBeenCalled();
  });

  it('approves, flips to live, and audit-logs when valid', async () => {
    vi.mocked(findOrganizationById).mockResolvedValueOnce(approvedOrg as never);
    vi.mocked(getAccessToken).mockResolvedValueOnce('token');
    vi.mocked(approveGoLive).mockResolvedValueOnce({ ...approvedOrg, environment: 'live' } as never);

    const res = await POST(req(), ctx('org-1'));
    expect(getAccessToken).toHaveBeenCalledWith('org-1', 'live');
    expect(approveGoLive).toHaveBeenCalledWith('org-1', 'admin-1');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'organization.live_approved' }));
    expect(res.status).toBe(200);
  });
});
