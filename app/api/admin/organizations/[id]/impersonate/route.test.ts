import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { findOrganizationById } from '@/lib/repositories/organizations';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminCapability: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ findOrganizationById: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

function makeRequest() {
  return new Request('http://localhost/api/admin/organizations/org-1/impersonate', { method: 'POST' });
}

describe('POST /api/admin/organizations/[id]/impersonate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires superadmin, not just any admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: false, error: 'Insufficient admin permissions for this action', status: 403 });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'org-1' }) });
    expect(response.status).toBe(403);
    expect(requireAdminCapability).toHaveBeenCalledWith('user-1', 'impersonate');
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('writes an audit log before returning the not-yet-implemented response', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'user-1', role: 'superadmin', createdAt: new Date() } });
    vi.mocked(findOrganizationById).mockResolvedValueOnce({ id: 'org-1', businessName: 'Acme' } as never);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'org-1' }) });

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', actorId: 'user-1', action: 'admin.impersonated' })
    );
    expect(response.status).toBe(501);
  });

  it('returns 404 for an unknown organization without writing an audit log', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'user-1', role: 'superadmin', createdAt: new Date() } });
    vi.mocked(findOrganizationById).mockResolvedValueOnce(null);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'org-missing' }) });
    expect(response.status).toBe(404);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
