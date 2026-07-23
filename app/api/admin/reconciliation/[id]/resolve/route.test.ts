import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-auth';
import { resolveMismatch } from '@/lib/repositories/reconciliation';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/repositories/reconciliation', () => ({ resolveMismatch: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body?: unknown) => new Request('http://localhost/api/admin/reconciliation/m-1/resolve', { method: 'POST', body: body ? JSON.stringify(body) : undefined });

describe('POST /api/admin/reconciliation/[id]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'admin-1' } as never);
  });

  it('403s a non-admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: false, error: 'no', status: 403 });
    const res = await POST(req({ status: 'resolved' }), ctx('m-1'));
    expect(res.status).toBe(403);
  });

  it('marks the mismatch and audit-logs', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: true, admin: { id: 'a', clerkUserId: 'admin-1', role: 'support', createdAt: new Date() } });
    const res = await POST(req({ status: 'ignored' }), ctx('m-1'));
    expect(res.status).toBe(200);
    expect(resolveMismatch).toHaveBeenCalledWith('m-1', 'ignored');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'reconciliation.mismatch_resolved' }));
  });

  it('defaults to resolved when no status is given', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ allowed: true, admin: { id: 'a', clerkUserId: 'admin-1', role: 'support', createdAt: new Date() } });
    await POST(req(), ctx('m-1'));
    expect(resolveMismatch).toHaveBeenCalledWith('m-1', 'resolved');
  });
});
