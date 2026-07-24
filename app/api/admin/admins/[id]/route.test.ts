import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { removeAdminUser } from '@/lib/repositories/admin';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminCapability: vi.fn() }));
vi.mock('@/lib/repositories/admin', () => ({ removeAdminUser: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('DELETE /api/admin/admins/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), ctx('admin-2'));
    expect(response.status).toBe(401);
  });

  it('rejects a support-role admin from removing another admin (superadmin only)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: false, error: 'Insufficient admin permissions for this action', status: 403 });

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), ctx('admin-2'));
    expect(response.status).toBe(403);
    expect(requireAdminCapability).toHaveBeenCalledWith('user-1', 'admin:manage');
    expect(removeAdminUser).not.toHaveBeenCalled();
  });

  it('removes the admin and writes an audit log', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'user-1', role: 'superadmin', createdAt: new Date() } });
    vi.mocked(removeAdminUser).mockResolvedValueOnce(undefined);

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), ctx('admin-2'));
    expect(response.status).toBe(200);
    expect(removeAdminUser).toHaveBeenCalledWith('admin-2');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin_user.removed' }));
  });
});
