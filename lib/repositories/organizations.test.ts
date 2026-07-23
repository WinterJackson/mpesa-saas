import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getOrganizationContext, updateMerchantForOrganization } from './organizations';

vi.mock('@/lib/db', () => ({
  prisma: {
    membership: {
      findFirst: vi.fn(),
    },
    merchant: {
      update: vi.fn(),
    },
  },
}));

describe('organizations repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getOrganizationContext resolves via Clerk active org id when provided', async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce({
      id: 'mem-1',
      organizationId: 'org-1',
      clerkUserId: 'user-1',
      role: 'owner',
      createdAt: new Date(),
      organization: {
        id: 'org-1',
        clerkOrgId: 'clerk-org-1',
        businessName: 'Acme',
        kycStatus: 'approved',
        liveApprovedAt: null,
        liveApprovedBy: null,
        environment: 'sandbox',
        createdAt: new Date(),
        merchant: null,
      },
    } as never);

    const context = await getOrganizationContext('user-1', 'clerk-org-1');

    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: 'user-1', organization: { clerkOrgId: 'clerk-org-1' } },
      })
    );
    expect(context?.organization.id).toBe('org-1');
    expect(context?.merchant).toBeNull();
  });

  it('getOrganizationContext falls back to the sole membership when no active org id is given', async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce({
      id: 'mem-1',
      organizationId: 'org-1',
      clerkUserId: 'user-1',
      role: 'owner',
      createdAt: new Date(),
      organization: {
        id: 'org-1',
        clerkOrgId: 'clerk-org-1',
        businessName: 'Acme',
        kycStatus: 'approved',
        liveApprovedAt: null,
        liveApprovedBy: null,
        environment: 'sandbox',
        createdAt: new Date(),
        merchant: null,
      },
    } as never);

    await getOrganizationContext('user-1');

    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: 'user-1' } })
    );
  });

  it('getOrganizationContext falls back to the user membership when the active org id does not match', async () => {
    // 1st call (active-org lookup) misses; 2nd call (fallback by clerkUserId) hits.
    vi.mocked(prisma.membership.findFirst)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        id: 'mem-1',
        organizationId: 'org-1',
        clerkUserId: 'user-1',
        role: 'owner',
        createdAt: new Date(),
        organization: {
          id: 'org-1',
          clerkOrgId: 'clerk-org-1',
          businessName: 'Acme',
          kycStatus: 'approved',
          liveRequestedAt: null,
          liveApprovedAt: null,
          liveApprovedBy: null,
          environment: 'sandbox',
          createdAt: new Date(),
          merchant: { id: 'merchant-1' },
        },
      } as never);

    const context = await getOrganizationContext('user-1', 'some-other-active-org');
    expect(prisma.membership.findFirst).toHaveBeenCalledTimes(2);
    expect(context?.organization.id).toBe('org-1');
  });

  it('getOrganizationContext returns null when no Membership exists', async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null as never);
    const context = await getOrganizationContext('user-1');
    expect(context).toBeNull();
  });

  it('updateMerchantForOrganization scopes the update via the unique organizationId', async () => {
    vi.mocked(prisma.merchant.update).mockResolvedValueOnce({} as never);
    await updateMerchantForOrganization('org-1', { environment: 'live' });
    expect(prisma.merchant.update).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      data: { environment: 'live' },
    });
  });
});
