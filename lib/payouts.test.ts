import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initiateB2C } from '@/lib/daraja-b2c';
import { createPayout, setPayoutInitiation, markPayoutFailedOnInitiation } from '@/lib/repositories/payouts';
import { createRefund, setRefundInitiation, markRefundFailedOnInitiation } from '@/lib/repositories/refunds';
import { createAndInitiatePayout, createAndInitiateRefund } from './payouts';

vi.mock('@/lib/daraja-b2c', () => ({ initiateB2C: vi.fn() }));
vi.mock('@/lib/repositories/payouts', () => ({
  createPayout: vi.fn(),
  setPayoutInitiation: vi.fn(),
  markPayoutFailedOnInitiation: vi.fn(),
}));
vi.mock('@/lib/repositories/refunds', () => ({
  createRefund: vi.fn(),
  setRefundInitiation: vi.fn(),
  markRefundFailedOnInitiation: vi.fn(),
}));

describe('createAndInitiatePayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPayout).mockResolvedValue({ id: 'payout-1' } as never);
  });

  it('persists Daraja correlation ids on success', async () => {
    vi.mocked(initiateB2C).mockResolvedValueOnce({
      ConversationID: 'AG_1',
      OriginatorConversationID: 'OC_1',
      ResponseCode: '0',
      ResponseDescription: 'ok',
    });

    const res = await createAndInitiatePayout({
      organizationId: 'org-1',
      merchantId: 'm-1',
      environment: 'sandbox',
      amount: 500,
      phone: '254712345678',
    });

    expect(createPayout).toHaveBeenCalledWith('org-1', expect.objectContaining({ merchantId: 'm-1', amount: 500 }));
    expect(setPayoutInitiation).toHaveBeenCalledWith('org-1', 'payout-1', {
      conversationId: 'AG_1',
      originatorConversationId: 'OC_1',
    });
    expect(res).toMatchObject({ success: true, payoutId: 'payout-1', originatorConversationId: 'OC_1' });
  });

  it('marks the payout failed when the gateway throws', async () => {
    vi.mocked(initiateB2C).mockRejectedValueOnce(new Error('Payment gateway timed out while sending the payout.'));

    const res = await createAndInitiatePayout({
      organizationId: 'org-1',
      merchantId: 'm-1',
      environment: 'sandbox',
      amount: 500,
      phone: '254712345678',
    });

    expect(markPayoutFailedOnInitiation).toHaveBeenCalledWith('org-1', 'payout-1', expect.stringMatching(/timed out/i));
    expect(setPayoutInitiation).not.toHaveBeenCalled();
    expect(res.success).toBe(false);
  });
});

describe('createAndInitiateRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createRefund).mockResolvedValue({ id: 'refund-1' } as never);
  });

  it('fires a B2C payout to the customer and records correlation ids', async () => {
    vi.mocked(initiateB2C).mockResolvedValueOnce({
      ConversationID: 'AG_2',
      OriginatorConversationID: 'OC_2',
      ResponseCode: '0',
      ResponseDescription: 'ok',
    });

    const res = await createAndInitiateRefund({
      organizationId: 'org-1',
      merchantId: 'm-1',
      transactionId: 'tx-1',
      environment: 'sandbox',
      amount: 250,
      phone: '254712345678',
      reason: 'Damaged item',
    });

    expect(createRefund).toHaveBeenCalledWith('org-1', expect.objectContaining({ transactionId: 'tx-1', amount: 250 }));
    expect(initiateB2C).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', amount: 250, remarks: 'Damaged item' }));
    expect(setRefundInitiation).toHaveBeenCalledWith('org-1', 'refund-1', {
      conversationId: 'AG_2',
      originatorConversationId: 'OC_2',
    });
    expect(res).toMatchObject({ success: true, refundId: 'refund-1' });
  });

  it('marks the refund failed when the gateway throws', async () => {
    vi.mocked(initiateB2C).mockRejectedValueOnce(new Error('Failed to send the payout.'));

    const res = await createAndInitiateRefund({
      organizationId: 'org-1',
      merchantId: 'm-1',
      transactionId: 'tx-1',
      environment: 'sandbox',
      amount: 250,
      phone: '254712345678',
    });

    expect(markRefundFailedOnInitiation).toHaveBeenCalledWith('org-1', 'refund-1', expect.any(String));
    expect(res.success).toBe(false);
  });
});
