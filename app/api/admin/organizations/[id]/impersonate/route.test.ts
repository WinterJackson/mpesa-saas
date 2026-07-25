import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { findOrganizationById, listMemberships } from '@/lib/repositories/organizations';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminCapability: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ findOrganizationById: vi.fn(), listMemberships: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

function makeRequest() {
  return new Request('http://localhost/api/admin/organizations/org-1/impersonate', { method: 'POST' });
}

const superadmin = { allowed: true, admin: { id: 'a1', clerkUserId: 'admin-1', role: 'superadmin', createdAt: new Date() } } as never;

describe('POST /api/admin/organizations/[id]/impersonate', () => {
  const create = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clerkClient).mockResolvedValue({ actorTokens: { create } } as never);
  });

  it('requires the impersonate capability, not just any admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'admin-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: false, error: 'Insufficient admin permissions for this action', status: 403 });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'org-1' }) });
    expect(response.status).toBe(403);
    expect(requireAdminCapability).toHaveBeenCalledWith('admin-1', 'impersonate');
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown organization without writing an audit log', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'admin-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce(superadmin);
    vi.mocked(findOrganizationById).mockResolvedValueOnce(null);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'org-missing' }) });
    expect(response.status).toBe(404);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('audits, mints an actor token for the owner, and returns a ticket URL', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'admin-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce(superadmin);
    vi.mocked(findOrganizationById).mockResolvedValueOnce({ id: 'org-1', businessName: 'Acme' } as never);
    vi.mocked(listMemberships).mockResolvedValueOnce([
      { clerkUserId: 'dev-9', role: 'developer' },
      { clerkUserId: 'owner-9', role: 'owner' },
    ] as never);
    create.mockResolvedValueOnce({ token: 'act_tok_123' });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'org-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ticketUrl).toContain('__clerk_ticket=act_tok_123');
    // Impersonates the OWNER, records the acting admin as the actor.
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner-9', actor: { sub: 'admin-1' } }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.impersonated', organizationId: 'org-1' }));
  });

  it('surfaces a clear error (and still audits) when actor tokens are unavailable', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'admin-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce(superadmin);
    vi.mocked(findOrganizationById).mockResolvedValueOnce({ id: 'org-1', businessName: 'Acme' } as never);
    vi.mocked(listMemberships).mockResolvedValueOnce([{ clerkUserId: 'owner-9', role: 'owner' }] as never);
    create.mockRejectedValueOnce(new Error('actor tokens disabled'));

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'org-1' }) });
    expect(response.status).toBe(502);
    expect(writeAuditLog).toHaveBeenCalled();
  });
});
