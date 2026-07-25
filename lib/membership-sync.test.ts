import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ clerkClient: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({
  findOrganizationByClerkOrgId: vi.fn(),
  findMembership: vi.fn(),
  createMembership: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { reconcileMembershipFromClerk } from './membership-sync';
import { clerkClient } from '@clerk/nextjs/server';
import {
  findOrganizationByClerkOrgId,
  findMembership,
  createMembership,
} from '@/lib/repositories/organizations';

function mockClerkMemberships(list: unknown[]) {
  const getOrganizationMembershipList = vi.fn().mockResolvedValue({ data: list });
  vi.mocked(clerkClient).mockResolvedValue({ organizations: { getOrganizationMembershipList } } as never);
  return getOrganizationMembershipList;
}

describe('reconcileMembershipFromClerk', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false when there is no active Clerk org id', async () => {
    expect(await reconcileMembershipFromClerk('user-1', null)).toBe(false);
    expect(findOrganizationByClerkOrgId).not.toHaveBeenCalled();
  });

  it('returns false when the Clerk org is not a known local org', async () => {
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce(null);
    expect(await reconcileMembershipFromClerk('user-1', 'clerk-org-x')).toBe(false);
    expect(createMembership).not.toHaveBeenCalled();
  });

  it('returns true without creating when a local membership already exists (webhook won the race)', async () => {
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);
    vi.mocked(findMembership).mockResolvedValueOnce({ id: 'mem-1', role: 'admin' } as never);
    expect(await reconcileMembershipFromClerk('user-1', 'clerk-org-1')).toBe(true);
    expect(createMembership).not.toHaveBeenCalled();
  });

  it('creates the local membership with the invited role from Clerk metadata', async () => {
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);
    vi.mocked(findMembership).mockResolvedValueOnce(null);
    mockClerkMemberships([
      { publicUserData: { userId: 'user-1' }, publicMetadata: { payswiftRole: 'finance' } },
    ]);

    const result = await reconcileMembershipFromClerk('user-1', 'clerk-org-1');
    expect(result).toBe(true);
    expect(createMembership).toHaveBeenCalledWith('org-1', 'user-1', 'finance');
  });

  it('defaults to developer when the Clerk membership has no valid payswiftRole', async () => {
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);
    vi.mocked(findMembership).mockResolvedValueOnce(null);
    mockClerkMemberships([{ publicUserData: { userId: 'user-1' }, publicMetadata: {} }]);

    await reconcileMembershipFromClerk('user-1', 'clerk-org-1');
    expect(createMembership).toHaveBeenCalledWith('org-1', 'user-1', 'developer');
  });

  it('returns false (no create) when the user is not actually in the Clerk org', async () => {
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);
    vi.mocked(findMembership).mockResolvedValueOnce(null);
    mockClerkMemberships([{ publicUserData: { userId: 'someone-else' }, publicMetadata: { payswiftRole: 'admin' } }]);

    expect(await reconcileMembershipFromClerk('user-1', 'clerk-org-1')).toBe(false);
    expect(createMembership).not.toHaveBeenCalled();
  });

  it('never throws — a Clerk failure just returns false', async () => {
    vi.mocked(findOrganizationByClerkOrgId).mockResolvedValueOnce({ id: 'org-1' } as never);
    vi.mocked(findMembership).mockResolvedValueOnce(null);
    vi.mocked(clerkClient).mockRejectedValueOnce(new Error('clerk down'));
    expect(await reconcileMembershipFromClerk('user-1', 'clerk-org-1')).toBe(false);
  });
});
