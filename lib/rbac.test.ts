import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireRole } from './rbac';
import { findMembership } from '@/lib/repositories/organizations';

vi.mock('@/lib/repositories/organizations', () => ({
  findMembership: vi.fn(),
}));

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies with 403 when the user has no membership in the organization', async () => {
    vi.mocked(findMembership).mockResolvedValueOnce(null);
    const result = await requireRole('org-1', 'user-1', ['owner']);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.status).toBe(403);
      expect(result.error).toMatch(/not a member/i);
    }
  });

  it('denies with 403 when the member role is not in the allowed list', async () => {
    vi.mocked(findMembership).mockResolvedValueOnce({
      id: 'mem-1',
      organizationId: 'org-1',
      clerkUserId: 'user-1',
      role: 'developer',
      createdAt: new Date(),
    });

    const result = await requireRole('org-1', 'user-1', ['owner', 'admin']);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.status).toBe(403);
      expect(result.error).toMatch(/insufficient permissions/i);
    }
  });

  it.each(['owner', 'admin', 'developer', 'finance'] as const)(
    'allows when the member role (%s) is in the allowed list',
    async (role) => {
      vi.mocked(findMembership).mockResolvedValueOnce({
        id: 'mem-1',
        organizationId: 'org-1',
        clerkUserId: 'user-1',
        role,
        createdAt: new Date(),
      });

      const result = await requireRole('org-1', 'user-1', [role]);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.membership.role).toBe(role);
      }
    }
  );
});
