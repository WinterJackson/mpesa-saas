import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listAdminUsers, createAdminUser } from '@/lib/repositories/admin';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/repositories/admin', () => ({
  listAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

describe('GET /api/admin/admins', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows any admin role to list admins', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'user-1', role: 'support', createdAt: new Date() } });
    vi.mocked(listAdminUsers).mockResolvedValueOnce([]);

    const response = await GET();
    expect(response.status).toBe(200);
  });
});

describe('POST /api/admin/admins', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/admin/admins', { method: 'POST', body: JSON.stringify(body) });
  }

  it('rejects a support-role admin from creating a new admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: false, error: 'Insufficient admin permissions for this action', status: 403 });

    const response = await POST(makeRequest({ clerkUserId: 'user-2', role: 'support' }));
    expect(response.status).toBe(403);
    expect(createAdminUser).not.toHaveBeenCalled();
    expect(requireAdmin).toHaveBeenCalledWith('user-1', ['superadmin']);
  });

  it('allows a superadmin to create a new admin and writes an audit log', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'user-1', role: 'superadmin', createdAt: new Date() } });
    vi.mocked(createAdminUser).mockResolvedValueOnce({ id: 'a2', clerkUserId: 'user-2', role: 'support', createdAt: new Date() });

    const response = await POST(makeRequest({ clerkUserId: 'user-2', role: 'support' }));
    expect(response.status).toBe(201);
    expect(createAdminUser).toHaveBeenCalledWith('user-2', 'support');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_user.created' }));
  });

  it('returns 400 for an invalid role', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'user-1', role: 'superadmin', createdAt: new Date() } });

    const response = await POST(makeRequest({ clerkUserId: 'user-2', role: 'god' }));
    expect(response.status).toBe(400);
  });
});
