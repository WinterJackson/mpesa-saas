import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import {
  findOrganizationByClerkOrgId,
  findMembership,
  createMembership,
  removeMembership,
  updateMembershipRole,
} from '@/lib/repositories/organizations';

vi.mock('@clerk/nextjs/webhooks', () => ({
  verifyWebhook: vi.fn(),
}));

vi.mock('@/lib/repositories/organizations', () => ({
  findOrganizationByClerkOrgId: vi.fn(),
  findMembership: vi.fn(),
  createMembership: vi.fn(),
  removeMembership: vi.fn(),
  updateMembershipRole: vi.fn(),
}));

function makeRequest() {
  return new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST', body: '{}' });
}

describe('POST /api/webhooks/clerk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when signature verification fails', async () => {
    vi.mocked(verifyWebhook).mockRejectedValueOnce(new Error('bad signature'));
    const response = await POST(makeRequest());
    expect(response.status).toBe(400);
    expect(findOrganizationByClerkOrgId).not.toHaveBeenCalled();
  });

  it('creates a Membership with the role from public_metadata.payswiftRole on organizationMembership.created', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({
      type: 'organizationMembership.created',
      data: {
        organization: { id: 'clerk-org-1' },
        public_user_data: { user_id: 'user-2' },
        public_metadata: { payswiftRole: 'admin' },
      },
    } as never);
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);
    vi.mocked(findMembership).mockResolvedValueOnce(null);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(createMembership).toHaveBeenCalledWith('org-1', 'user-2', 'admin');
  });

  it('defaults to developer role when public_metadata.payswiftRole is missing or invalid', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({
      type: 'organizationMembership.created',
      data: {
        organization: { id: 'clerk-org-1' },
        public_user_data: { user_id: 'user-2' },
        public_metadata: {},
      },
    } as never);
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);
    vi.mocked(findMembership).mockResolvedValueOnce(null);

    await POST(makeRequest());
    expect(createMembership).toHaveBeenCalledWith('org-1', 'user-2', 'developer');
  });

  it('is idempotent: does not duplicate a Membership that already exists', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({
      type: 'organizationMembership.created',
      data: {
        organization: { id: 'clerk-org-1' },
        public_user_data: { user_id: 'user-1' },
        public_metadata: {},
      },
    } as never);
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);
    vi.mocked(findMembership).mockResolvedValueOnce({ id: 'mem-1' } as never);

    await POST(makeRequest());
    expect(createMembership).not.toHaveBeenCalled();
  });

  it('removes the Membership on organizationMembership.deleted', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({
      type: 'organizationMembership.deleted',
      data: {
        organization: { id: 'clerk-org-1' },
        public_user_data: { user_id: 'user-2' },
      },
    } as never);
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(removeMembership).toHaveBeenCalledWith('org-1', 'user-2');
  });

  it('ignores unrelated Clerk event types', async () => {
    vi.mocked(verifyWebhook).mockResolvedValueOnce({
      type: 'user.created',
      data: {},
    } as never);

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(findOrganizationByClerkOrgId).not.toHaveBeenCalled();
    expect(updateMembershipRole).not.toHaveBeenCalled();
  });
});
