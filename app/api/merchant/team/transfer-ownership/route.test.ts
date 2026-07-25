import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getOrganizationContext, findMembership, transferOwnership } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
  findMembership: vi.fn(),
  transferOwnership: vi.fn(),
}));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/merchant/team/transfer-ownership', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/merchant/team/transfer-ownership', () => {
  const updateOrganizationMembershipMetadata = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'owner-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({ organization: { id: 'org-1', clerkOrgId: 'corg-1' }, membership: { role: 'owner' }, merchant: {} } as never);
    vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'owner' } } as never);
    vi.mocked(findMembership).mockResolvedValue({ id: 'm2', clerkUserId: 'user-2', role: 'admin' } as never);
    vi.mocked(clerkClient).mockResolvedValue({ organizations: { updateOrganizationMembershipMetadata } } as never);
  });

  it('rejects a non-owner (admins cannot transfer ownership)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions for this action', status: 403 } as never);
    const response = await POST(makeRequest({ clerkUserId: 'user-2' }));
    expect(response.status).toBe(403);
    expect(transferOwnership).not.toHaveBeenCalled();
    expect(requireRole).toHaveBeenCalledWith('org-1', 'owner-1', ['owner']);
  });

  it('rejects transferring to yourself', async () => {
    const response = await POST(makeRequest({ clerkUserId: 'owner-1' }));
    expect(response.status).toBe(400);
    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it('404s when the target is not a member', async () => {
    vi.mocked(findMembership).mockResolvedValueOnce(null as never);
    const response = await POST(makeRequest({ clerkUserId: 'ghost' }));
    expect(response.status).toBe(404);
    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it('transfers ownership: updates Clerk metadata for both, swaps roles, audits', async () => {
    const response = await POST(makeRequest({ clerkUserId: 'user-2' }));
    expect(response.status).toBe(200);
    expect(updateOrganizationMembershipMetadata).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2', publicMetadata: { payswiftRole: 'owner' } }));
    expect(updateOrganizationMembershipMetadata).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner-1', publicMetadata: { payswiftRole: 'admin' } }));
    expect(transferOwnership).toHaveBeenCalledWith('org-1', 'owner-1', 'user-2');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'team.ownership_transferred' }));
  });
});
