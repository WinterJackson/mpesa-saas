import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { adminFindPayoutById } from '@/lib/repositories/payouts';
import { reverseTransaction } from '@/lib/daraja-reversal';
import { createDarajaCommand } from '@/lib/repositories/daraja-commands';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminCapability: vi.fn() }));
vi.mock('@/lib/repositories/payouts', () => ({ adminFindPayoutById: vi.fn() }));
vi.mock('@/lib/daraja-reversal', () => ({ reverseTransaction: vi.fn() }));
vi.mock('@/lib/repositories/daraja-commands', () => ({ createDarajaCommand: vi.fn() }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request('http://localhost/api/admin/payouts/p-1/reverse', { method: 'POST' });
const completedPayout = { id: 'p-1', status: 'completed', mpesaReceipt: 'LGR1', amount: 500, organizationId: 'org-1', environment: 'live' };

describe('POST /api/admin/payouts/[id]/reverse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'admin-1' } as never);
  });

  it('requires superadmin', async () => {
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: false, error: 'no', status: 403 });
    const res = await POST(req(), ctx('p-1'));
    expect(res.status).toBe(403);
    expect(requireAdminCapability).toHaveBeenCalledWith('admin-1', 'payout:reverse');
    expect(reverseTransaction).not.toHaveBeenCalled();
  });

  it('400s a non-completed payout', async () => {
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: true, admin: { id: 'a', clerkUserId: 'admin-1', role: 'superadmin', createdAt: new Date() } });
    vi.mocked(adminFindPayoutById).mockResolvedValueOnce({ ...completedPayout, status: 'pending' } as never);
    const res = await POST(req(), ctx('p-1'));
    expect(res.status).toBe(400);
  });

  it('queues the reversal, records a DarajaCommand with targetPayoutId, and audit-logs', async () => {
    vi.mocked(requireAdminCapability).mockResolvedValueOnce({ allowed: true, admin: { id: 'a', clerkUserId: 'admin-1', role: 'superadmin', createdAt: new Date() } });
    vi.mocked(adminFindPayoutById).mockResolvedValueOnce(completedPayout as never);
    vi.mocked(reverseTransaction).mockResolvedValueOnce({ OriginatorConversationID: 'OC', ConversationID: 'C', ResponseCode: '0', ResponseDescription: 'ok' });

    const res = await POST(req(), ctx('p-1'));
    expect(res.status).toBe(202);
    expect(reverseTransaction).toHaveBeenCalledWith(expect.objectContaining({ transactionReceipt: 'LGR1', amount: 500 }));
    expect(createDarajaCommand).toHaveBeenCalledWith('org-1', expect.objectContaining({ type: 'reversal', targetPayoutId: 'p-1' }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'payout.reversal_requested' }));
  });
});
