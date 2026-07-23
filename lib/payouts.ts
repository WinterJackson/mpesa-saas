import { initiateB2C, type B2CCommandID } from '@/lib/daraja-b2c';
import {
  createPayout,
  setPayoutInitiation,
  markPayoutFailedOnInitiation,
} from '@/lib/repositories/payouts';
import {
  createRefund,
  setRefundInitiation,
  markRefundFailedOnInitiation,
} from '@/lib/repositories/refunds';

export type InitiatePayoutResult =
  | { success: true; payoutId: string; conversationId: string; originatorConversationId: string }
  | { success: false; error: string; payoutId?: string };

export type InitiateRefundResult =
  | { success: true; refundId: string; conversationId: string; originatorConversationId: string }
  | { success: false; error: string; refundId?: string };

/**
 * Creates a pending Payout, fires the B2C request, and persists Daraja's
 * correlation ids. Mirrors lib/payments.ts's createAndInitiatePayment. Terminal
 * status arrives later via the B2C result callback.
 */
export async function createAndInitiatePayout(params: {
  organizationId: string;
  merchantId: string;
  environment: 'sandbox' | 'live';
  amount: number;
  phone: string;
  commandId?: B2CCommandID;
  remarks?: string | null;
  occasion?: string | null;
}): Promise<InitiatePayoutResult> {
  const { organizationId, merchantId, environment, amount, phone, commandId, remarks, occasion } = params;

  const payout = await createPayout(organizationId, {
    merchantId,
    amount,
    phone,
    commandId,
    remarks,
    occasion,
    environment,
  });

  try {
    const res = await initiateB2C({ organizationId, environment, amount, phone, commandId, remarks: remarks ?? undefined, occasion: occasion ?? undefined });
    await setPayoutInitiation(organizationId, payout.id, {
      conversationId: res.ConversationID,
      originatorConversationId: res.OriginatorConversationID,
    });
    return {
      success: true,
      payoutId: payout.id,
      conversationId: res.ConversationID,
      originatorConversationId: res.OriginatorConversationID,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Payout gateway failed';
    await markPayoutFailedOnInitiation(organizationId, payout.id, error);
    return { success: false, error, payoutId: payout.id };
  }
}

/**
 * Refund = B2C disbursement back to the customer for a specific Transaction.
 */
export async function createAndInitiateRefund(params: {
  organizationId: string;
  merchantId: string;
  transactionId: string;
  environment: 'sandbox' | 'live';
  amount: number;
  phone: string;
  reason?: string | null;
}): Promise<InitiateRefundResult> {
  const { organizationId, merchantId, transactionId, environment, amount, phone, reason } = params;

  const refund = await createRefund(organizationId, {
    merchantId,
    transactionId,
    amount,
    phone,
    reason,
    environment,
  });

  try {
    const res = await initiateB2C({
      organizationId,
      environment,
      amount,
      phone,
      commandId: 'BusinessPayment',
      remarks: reason ?? 'Refund',
    });
    await setRefundInitiation(organizationId, refund.id, {
      conversationId: res.ConversationID,
      originatorConversationId: res.OriginatorConversationID,
    });
    return {
      success: true,
      refundId: refund.id,
      conversationId: res.ConversationID,
      originatorConversationId: res.OriginatorConversationID,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Refund gateway failed';
    await markRefundFailedOnInitiation(organizationId, refund.id, error);
    return { success: false, error, refundId: refund.id };
  }
}
