import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { createDeletionRequest, hasPendingDeletionRequest } from '@/lib/repositories/data-deletion-requests';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/repositories/data-deletion-requests', () => ({
  createDeletionRequest: vi.fn(),
  hasPendingDeletionRequest: vi.fn(),
  listDeletionRequestsForOrganization: vi.fn(),
}));

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/merchant/data-deletion-request', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/merchant/data-deletion-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: {},
      merchant: { id: 'merchant-1' },
    } as never);
    vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'owner' } as never });
    vi.mocked(hasPendingDeletionRequest).mockResolvedValue(false);
    vi.mocked(createDeletionRequest).mockResolvedValue({ id: 'ddr-1', status: 'pending' } as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const res = await POST(makeRequest({ reason: 'x' }));
    expect(res.status).toBe(401);
  });

  it('rejects a non-owner (admin) — deleting org data is owner-only', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions for this action', status: 403 });
    const res = await POST(makeRequest({ reason: 'x' }));
    expect(res.status).toBe(403);
    expect(createDeletionRequest).not.toHaveBeenCalled();
  });

  it('409s when a request is already pending', async () => {
    vi.mocked(hasPendingDeletionRequest).mockResolvedValueOnce(true);
    const res = await POST(makeRequest({ reason: 'x' }));
    expect(res.status).toBe(409);
    expect(createDeletionRequest).not.toHaveBeenCalled();
  });

  it('records the request and an audit log entry, and does NOT auto-delete', async () => {
    const res = await POST(makeRequest({ reason: 'closing shop' }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(createDeletionRequest).toHaveBeenCalledWith('org-1', 'user-1', 'closing shop');
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'data.deletion_requested', organizationId: 'org-1' })
    );
    // The response makes the not-automatic nature explicit to the merchant.
    expect(data.data.message).toMatch(/not automatic/i);
  });

  it('accepts a request with no body (reason optional)', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    expect(createDeletionRequest).toHaveBeenCalledWith('org-1', 'user-1', null);
  });
});
