import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  // Run the fire-and-forget callback synchronously so post-response
  // notifications are observable in assertions.
  after: (cb: () => unknown) => { void cb(); },
}));
import { POST } from './route';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import {
  findAdminUserByEmail,
  findAdminUserByClerkId,
  createAdminUser,
  upsertAdminInvite,
} from '@/lib/repositories/admin';
import { notifyAdminInvited, notifyAdminAccessGranted } from '@/lib/email/notifications';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminCapability: vi.fn() }));
vi.mock('@/lib/repositories/admin', () => ({
  findAdminUserByEmail: vi.fn(),
  findAdminUserByClerkId: vi.fn(),
  createAdminUser: vi.fn(),
  upsertAdminInvite: vi.fn(),
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}));
vi.mock('@/lib/email/notifications', () => ({
  notifyAdminInvited: vi.fn(),
  notifyAdminAccessGranted: vi.fn(),
}));
vi.mock('@/lib/email/layout', () => ({ appBaseUrl: () => 'https://app.test' }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/admins/invite', { method: 'POST', body: JSON.stringify(body) });
}

function mockClerkUserList(users: unknown[]) {
  const getUserList = vi.fn().mockResolvedValue({ data: users });
  vi.mocked(clerkClient).mockResolvedValue({ users: { getUserList } } as never);
  return getUserList;
}

describe('POST /api/admin/admins/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'super-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValue({ allowed: true, admin: { id: 'a1', clerkUserId: 'super-1', role: 'superadmin', createdAt: new Date() } } as never);
    vi.mocked(findAdminUserByEmail).mockResolvedValue(null as never);
    vi.mocked(findAdminUserByClerkId).mockResolvedValue(null as never);
  });

  it('rejects a non-superadmin (needs admin:manage)', async () => {
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: false, error: 'Insufficient admin permissions for this action', status: 403 } as never);
    const response = await POST(makeRequest({ email: 'x@y.com', role: 'support' }));
    expect(response.status).toBe(403);
    expect(requireAdminCapability).toHaveBeenCalledWith('super-1', 'admin:manage');
  });

  it('rejects an invalid email', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email', role: 'support' }));
    expect(response.status).toBe(400);
  });

  it('rejects an invalid role', async () => {
    const response = await POST(makeRequest({ email: 'x@y.com', role: 'god' }));
    expect(response.status).toBe(400);
  });

  it('409s when the email already has admin access', async () => {
    vi.mocked(findAdminUserByEmail).mockResolvedValueOnce({ id: 'a2', clerkUserId: 'u2', role: 'ops', createdAt: new Date() } as never);
    const response = await POST(makeRequest({ email: 'x@y.com', role: 'support' }));
    expect(response.status).toBe(409);
    expect(createAdminUser).not.toHaveBeenCalled();
  });

  it('grants immediately when the email already belongs to a Clerk user', async () => {
    mockClerkUserList([{ id: 'user-99', firstName: 'Ada', lastName: 'Lovelace' }]);
    vi.mocked(createAdminUser).mockResolvedValueOnce({ id: 'a3', clerkUserId: 'user-99', role: 'ops', createdAt: new Date() } as never);

    const response = await POST(makeRequest({ email: 'Ada@Example.com', role: 'ops' }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.status).toBe('granted');
    // Email normalized to lowercase; display name assembled from Clerk.
    expect(createAdminUser).toHaveBeenCalledWith('user-99', 'ops', expect.objectContaining({ email: 'ada@example.com', displayName: 'Ada Lovelace', createdBy: 'super-1' }));
    expect(notifyAdminAccessGranted).toHaveBeenCalledWith('ada@example.com', 'ops', 'https://app.test/admin');
    expect(upsertAdminInvite).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_user.created' }));
  });

  it('creates a pending invite + emails a sign-up link when no Clerk user exists', async () => {
    mockClerkUserList([]);
    vi.mocked(upsertAdminInvite).mockResolvedValueOnce({ id: 'inv-1', email: 'new@x.com', role: 'kyc_reviewer', expiresAt: new Date(), token: 't', invitedBy: 'super-1', acceptedAt: null, acceptedBy: null, createdAt: new Date() } as never);

    const response = await POST(makeRequest({ email: 'new@x.com', role: 'kyc_reviewer' }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.status).toBe('invited');
    expect(upsertAdminInvite).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@x.com', role: 'kyc_reviewer', invitedBy: 'super-1' }));
    expect(createAdminUser).not.toHaveBeenCalled();
    expect(notifyAdminInvited).toHaveBeenCalledWith('new@x.com', 'kyc_reviewer', expect.stringContaining('/sign-up?redirect_url='));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_invite.created' }));
  });
});
