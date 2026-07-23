import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));
vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
}));
vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({
  writeAuditLog: vi.fn(),
}));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/merchant/team/invite', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/merchant/team/invite', () => {
  const createOrganizationInvitation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1', clerkOrgId: 'clerk-org-1' },
      membership: {},
      merchant: null,
    } as never);
    vi.mocked(clerkClient).mockResolvedValue({
      organizations: { createOrganizationInvitation },
    } as never);
  });

  it('rejects a developer-role member from inviting anyone', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions for this action', status: 403 });
    const response = await POST(makeRequest({ email: 'a@b.com', role: 'developer' }));
    expect(response.status).toBe(403);
    expect(createOrganizationInvitation).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid role', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: true, membership: { role: 'owner' } as never });
    const response = await POST(makeRequest({ email: 'a@b.com', role: 'owner' }));
    expect(response.status).toBe(400);
  });

  it('invites via Clerk with the org clerkOrgId and carries the PaySwift role in publicMetadata', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: true, membership: { role: 'owner' } as never });
    const response = await POST(makeRequest({ email: 'teammate@acme.com', role: 'admin' }));

    expect(createOrganizationInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'clerk-org-1',
        emailAddress: 'teammate@acme.com',
        role: 'org:member',
        publicMetadata: { payswiftRole: 'admin' },
      })
    );
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'team.invited' }));
    expect(response.status).toBe(201);
  });
});
