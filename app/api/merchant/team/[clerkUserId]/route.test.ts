import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from './route';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getOrganizationContext, findMembership, updateMembershipRole, removeMembership } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));
vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
  findMembership: vi.fn(),
  updateMembershipRole: vi.fn(),
  removeMembership: vi.fn(),
}));
vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

function ctx(clerkUserId: string) {
  return { params: Promise.resolve({ clerkUserId }) };
}

describe('team member routes', () => {
  const updateOrganizationMembershipMetadata = vi.fn();
  const deleteOrganizationMembership = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1', clerkOrgId: 'clerk-org-1' },
      membership: {},
      merchant: null,
    } as never);
    vi.mocked(clerkClient).mockResolvedValue({
      organizations: { updateOrganizationMembershipMetadata, deleteOrganizationMembership },
    } as never);
  });

  describe('PATCH', () => {
    function makeRequest(body: unknown) {
      return new Request('http://localhost/api/merchant/team/user-2', { method: 'PATCH', body: JSON.stringify(body) });
    }

    it('refuses to change the owner role', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ allowed: true, membership: { role: 'owner' } as never });
      vi.mocked(findMembership).mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', clerkUserId: 'user-2', role: 'owner', createdAt: new Date() });

      const response = await PATCH(makeRequest({ role: 'admin' }), ctx('user-2'));
      expect(response.status).toBe(400);
      expect(updateOrganizationMembershipMetadata).not.toHaveBeenCalled();
    });

    it('updates Clerk metadata and the local Membership role', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ allowed: true, membership: { role: 'owner' } as never });
      vi.mocked(findMembership).mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', clerkUserId: 'user-2', role: 'developer', createdAt: new Date() });
      vi.mocked(updateMembershipRole).mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', clerkUserId: 'user-2', role: 'admin', createdAt: new Date() });

      const response = await PATCH(makeRequest({ role: 'admin' }), ctx('user-2'));

      expect(updateOrganizationMembershipMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'clerk-org-1', userId: 'user-2', publicMetadata: { payswiftRole: 'admin' } })
      );
      expect(updateMembershipRole).toHaveBeenCalledWith('org-1', 'user-2', 'admin');
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'team.role_changed' }));
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE', () => {
    function makeRequest() {
      return new Request('http://localhost/api/merchant/team/user-2', { method: 'DELETE' });
    }

    it('refuses to remove the owner', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ allowed: true, membership: { role: 'owner' } as never });
      vi.mocked(findMembership).mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', clerkUserId: 'user-2', role: 'owner', createdAt: new Date() });

      const response = await DELETE(makeRequest(), ctx('user-2'));
      expect(response.status).toBe(400);
      expect(deleteOrganizationMembership).not.toHaveBeenCalled();
    });

    it('removes the member from Clerk and the local Membership table', async () => {
      vi.mocked(requireRole).mockResolvedValueOnce({ allowed: true, membership: { role: 'owner' } as never });
      vi.mocked(findMembership).mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', clerkUserId: 'user-2', role: 'developer', createdAt: new Date() });

      const response = await DELETE(makeRequest(), ctx('user-2'));

      expect(deleteOrganizationMembership).toHaveBeenCalledWith({ organizationId: 'clerk-org-1', userId: 'user-2' });
      expect(removeMembership).toHaveBeenCalledWith('org-1', 'user-2');
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'team.member_removed' }));
      expect(response.status).toBe(200);
    });
  });
});
