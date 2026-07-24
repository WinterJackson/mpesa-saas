import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { markInvoicePaid } from '@/lib/repositories/billing';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminCapability: vi.fn() }));
vi.mock('@/lib/repositories/billing', () => ({ markInvoicePaid: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

function makeRequest() {
  return new Request('http://localhost/api/admin/invoices/inv-1/mark-paid', { method: 'POST' });
}

describe('POST /api/admin/invoices/[id]/mark-paid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when the caller is not an admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: false, error: 'Not authorized', status: 403 });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'inv-1' }) });
    expect(response.status).toBe(403);
    expect(markInvoicePaid).not.toHaveBeenCalled();
  });

  it('marks the invoice paid and writes an audit log', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'admin-1' } as never);
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: true, admin: { id: 'a1', clerkUserId: 'admin-1', role: 'support', createdAt: new Date() } });
    vi.mocked(markInvoicePaid).mockResolvedValueOnce({ id: 'inv-1', amount: 5000, status: 'paid' } as never);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'inv-1' }) });
    expect(response.status).toBe(200);
    expect(markInvoicePaid).toHaveBeenCalledWith('inv-1');
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'invoice.marked_paid' }));
  });
});
