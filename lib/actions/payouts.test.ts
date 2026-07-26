import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/transactions', () => ({ findTransactionById: vi.fn() }));
vi.mock('@/lib/payouts', () => ({ createAndInitiatePayout: vi.fn(), createAndInitiateRefund: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn(), PAYOUT_ROLES: ['admin', 'owner', 'finance'] }));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { sendPayoutAction, refundTransactionAction } from './payouts';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { findTransactionById } from '@/lib/repositories/transactions';
import { createAndInitiatePayout, createAndInitiateRefund } from '@/lib/payouts';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';

const ctx = { organization: { id: 'org-1' }, membership: { role: 'finance' }, merchant: { id: 'm-1', environment: 'sandbox' } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
  vi.mocked(getOrganizationContext).mockResolvedValue(ctx as never);
  vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'finance' } } as never);
});

describe('sendPayoutAction', () => {
  it('rejects a role without payout permission (e.g. developer)', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ allowed: false, error: 'Insufficient permissions for this action', status: 403 } as never);
    const res = await sendPayoutAction({ phone: '0712345678', amount: 1000 });
    expect(res.success).toBe(false);
    expect(createAndInitiatePayout).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone number', async () => {
    const res = await sendPayoutAction({ phone: '123', amount: 1000 });
    expect(res.success).toBe(false);
    expect(createAndInitiatePayout).not.toHaveBeenCalled();
  });

  it('rejects a non-integer / out-of-range amount', async () => {
    const res = await sendPayoutAction({ phone: '0712345678', amount: 0 });
    expect(res.success).toBe(false);
    expect(createAndInitiatePayout).not.toHaveBeenCalled();
  });

  it('sends the payout via the shared orchestration and audits it', async () => {
    vi.mocked(createAndInitiatePayout).mockResolvedValueOnce({ success: true, payoutId: 'po-1', conversationId: 'c', originatorConversationId: 'o' });
    const res = await sendPayoutAction({ phone: '0712345678', amount: 1000, remarks: 'Supplier' });
    expect(res.success).toBe(true);
    expect(createAndInitiatePayout).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', merchantId: 'm-1', environment: 'sandbox', amount: 1000, phone: '254712345678' }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'payout.initiated' }));
  });

  it('surfaces a friendly message when the gateway/credentials fail', async () => {
    vi.mocked(createAndInitiatePayout).mockResolvedValueOnce({ success: false, error: 'initiator SecurityCredential missing' });
    const res = await sendPayoutAction({ phone: '0712345678', amount: 1000 });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/initiator credentials/i);
  });
});

describe('refundTransactionAction', () => {
  it('404s when the transaction is not the org’s', async () => {
    vi.mocked(findTransactionById).mockResolvedValueOnce(null as never);
    const res = await refundTransactionAction({ transactionId: 'tx-x' });
    expect(res.success).toBe(false);
    expect(createAndInitiateRefund).not.toHaveBeenCalled();
  });

  it('refuses to refund a non-completed transaction', async () => {
    vi.mocked(findTransactionById).mockResolvedValueOnce({ id: 'tx-1', status: 'pending', amount: 500, phone: '254712345678' } as never);
    const res = await refundTransactionAction({ transactionId: 'tx-1' });
    expect(res.success).toBe(false);
    expect(createAndInitiateRefund).not.toHaveBeenCalled();
  });

  it('rejects a partial amount greater than the original', async () => {
    vi.mocked(findTransactionById).mockResolvedValueOnce({ id: 'tx-1', status: 'completed', amount: 500, phone: '254712345678' } as never);
    const res = await refundTransactionAction({ transactionId: 'tx-1', amount: 900 });
    expect(res.success).toBe(false);
    expect(createAndInitiateRefund).not.toHaveBeenCalled();
  });

  it('refunds a completed transaction to its original customer phone', async () => {
    vi.mocked(findTransactionById).mockResolvedValueOnce({ id: 'tx-1', status: 'completed', amount: 500, phone: '254712345678' } as never);
    vi.mocked(createAndInitiateRefund).mockResolvedValueOnce({ success: true, refundId: 'rf-1', conversationId: 'c', originatorConversationId: 'o' });
    const res = await refundTransactionAction({ transactionId: 'tx-1' });
    expect(res.success).toBe(true);
    // Full amount, and the phone comes from the transaction, never client input.
    expect(createAndInitiateRefund).toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'tx-1', amount: 500, phone: '254712345678' }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'refund.initiated' }));
  });
});
