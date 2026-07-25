import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/repositories/admin', () => ({
  findAdminUserByClerkId: vi.fn(),
  findPendingInviteByEmail: vi.fn(),
  createAdminUser: vi.fn(),
  markAdminInviteAccepted: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { reconcileAdminFromInvite } from './admin-invite-sync';
import {
  findAdminUserByClerkId,
  findPendingInviteByEmail,
  createAdminUser,
  markAdminInviteAccepted,
} from '@/lib/repositories/admin';
import { writeAuditLog } from '@/lib/repositories/audit-log';

describe('reconcileAdminFromInvite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true (no create) when already an admin', async () => {
    vi.mocked(findAdminUserByClerkId).mockResolvedValueOnce({ id: 'a1', clerkUserId: 'u1', role: 'ops', createdAt: new Date() } as never);
    expect(await reconcileAdminFromInvite('u1', 'x@y.com')).toBe(true);
    expect(createAdminUser).not.toHaveBeenCalled();
  });

  it('returns false when there is no email', async () => {
    vi.mocked(findAdminUserByClerkId).mockResolvedValueOnce(null as never);
    expect(await reconcileAdminFromInvite('u1', null)).toBe(false);
    expect(findPendingInviteByEmail).not.toHaveBeenCalled();
  });

  it('returns false when no pending invite matches the email', async () => {
    vi.mocked(findAdminUserByClerkId).mockResolvedValueOnce(null as never);
    vi.mocked(findPendingInviteByEmail).mockResolvedValueOnce(null as never);
    expect(await reconcileAdminFromInvite('u1', 'x@y.com')).toBe(false);
    expect(createAdminUser).not.toHaveBeenCalled();
  });

  it('promotes the user to AdminUser with the invited role and marks the invite accepted', async () => {
    vi.mocked(findAdminUserByClerkId).mockResolvedValueOnce(null as never);
    vi.mocked(findPendingInviteByEmail).mockResolvedValueOnce({ id: 'inv-1', email: 'x@y.com', role: 'finance', invitedBy: 'super-1', token: 't', acceptedAt: null, acceptedBy: null, expiresAt: new Date(Date.now() + 1000), createdAt: new Date() } as never);
    vi.mocked(createAdminUser).mockResolvedValueOnce({ id: 'a2', clerkUserId: 'u1', role: 'finance', createdAt: new Date() } as never);

    const result = await reconcileAdminFromInvite('u1', 'x@y.com');
    expect(result).toBe(true);
    expect(createAdminUser).toHaveBeenCalledWith('u1', 'finance', expect.objectContaining({ email: 'x@y.com', createdBy: 'super-1' }));
    expect(markAdminInviteAccepted).toHaveBeenCalledWith('inv-1', 'u1');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_invite.accepted' }));
  });

  it('never throws — a repo failure just returns false', async () => {
    vi.mocked(findAdminUserByClerkId).mockRejectedValueOnce(new Error('db down'));
    expect(await reconcileAdminFromInvite('u1', 'x@y.com')).toBe(false);
  });
});
