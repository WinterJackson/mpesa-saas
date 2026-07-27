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
  | { success: true; payoutId: string; requiresApproval: true }
  | { success: false; error: string; payoutId?: string };

export type InitiateRefundResult =
  | { success: true; refundId: string; conversationId: string; originatorConversationId: string }
  | { success: false; error: string; refundId?: string };

import { findOrganizationById } from '@/lib/repositories/organizations';
import { DEFAULT_PAYOUT_APPROVAL_THRESHOLD_KES } from '@/lib/pricing';
import { updatePayoutApprovalStatus, findPayoutById } from '@/lib/repositories/payouts';
import { requireRole, PAYOUT_ROLES } from '@/lib/rbac';

export async function resolvePayoutApprovalThreshold(organizationId: string): Promise<number> {
  const org = await findOrganizationById(organizationId);
  return org?.payoutApprovalThresholdKes ?? DEFAULT_PAYOUT_APPROVAL_THRESHOLD_KES;
}

export async function getPayoutApprovalRequirement(organizationId: string, amount: number) {
  const threshold = await resolvePayoutApprovalThreshold(organizationId);
  return { requiresApproval: amount >= threshold, threshold };
}

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
  initiatedByUserId?: string | null;
}): Promise<InitiatePayoutResult> {
  const { organizationId, merchantId, environment, amount, phone, commandId, remarks, occasion, initiatedByUserId } = params;

  const { requiresApproval } = await getPayoutApprovalRequirement(organizationId, amount);

  const payout = await createPayout(organizationId, {
    merchantId,
    amount,
    phone,
    commandId,
    remarks,
    occasion,
    environment,
    initiatedByUserId: initiatedByUserId ?? null,
    requiresApproval,
    approvalStatus: requiresApproval ? 'pending' : 'not_required',
  });

  if (requiresApproval) {
    return {
      success: true,
      payoutId: payout.id,
      requiresApproval: true,
    };
  }

  return initiateAndPersistPayoutB2C(organizationId, payout.id, {
    environment,
    amount,
    phone,
    commandId,
    remarks: remarks ?? undefined,
    occasion: occasion ?? undefined,
  });
}

/**
 * Shared helper for the actual B2C daraja call, used by initial creation (if below threshold)
 * and by approval.
 */
export async function initiateAndPersistPayoutB2C(
  organizationId: string,
  payoutId: string,
  opts: {
    environment: 'sandbox' | 'live';
    amount: number;
    phone: string;
    commandId?: B2CCommandID;
    remarks?: string;
    occasion?: string;
  }
): Promise<InitiatePayoutResult> {
  try {
    const res = await initiateB2C({ 
      organizationId, 
      environment: opts.environment, 
      amount: opts.amount, 
      phone: opts.phone, 
      commandId: opts.commandId, 
      remarks: opts.remarks, 
      occasion: opts.occasion 
    });
    await setPayoutInitiation(organizationId, payoutId, {
      conversationId: res.ConversationID,
      originatorConversationId: res.OriginatorConversationID,
    });
    return {
      success: true,
      payoutId,
      conversationId: res.ConversationID,
      originatorConversationId: res.OriginatorConversationID,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Payout gateway failed';
    await markPayoutFailedOnInitiation(organizationId, payoutId, error);
    return { success: false, error, payoutId };
  }
}

export async function approvePayout(
  organizationId: string,
  payoutId: string,
  approvingUserId: string
): Promise<InitiatePayoutResult> {
  const rbac = await requireRole(organizationId, approvingUserId, PAYOUT_ROLES);
  if (!rbac.allowed) return { success: false, error: rbac.error, payoutId };

  const payout = await findPayoutById(organizationId, payoutId);
  if (!payout) return { success: false, error: 'Payout not found', payoutId };

  if (payout.approvalStatus !== 'pending') {
    return { success: false, error: 'Payout is not pending approval', payoutId };
  }

  // Enforce self-approval block
  if (payout.initiatedByUserId != null && payout.initiatedByUserId === approvingUserId) {
    return { success: false, error: 'You cannot approve a payout you initiated', payoutId };
  }

  await updatePayoutApprovalStatus(organizationId, payoutId, {
    approvalStatus: 'approved',
    approvedByUserId: approvingUserId,
    approvedAt: new Date(),
  });

  return initiateAndPersistPayoutB2C(organizationId, payoutId, {
    environment: payout.environment as 'sandbox' | 'live',
    amount: payout.amount,
    phone: payout.phone,
    commandId: (payout.commandId as B2CCommandID) || undefined,
    remarks: payout.remarks || undefined,
    occasion: payout.occasion || undefined,
  });
}

export async function rejectPayout(
  organizationId: string,
  payoutId: string,
  rejectingUserId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const rbac = await requireRole(organizationId, rejectingUserId, PAYOUT_ROLES);
  if (!rbac.allowed) return { success: false, error: rbac.error };

  const payout = await findPayoutById(organizationId, payoutId);
  if (!payout) return { success: false, error: 'Payout not found' };

  if (payout.approvalStatus !== 'pending') {
    return { success: false, error: 'Payout is not pending approval' };
  }

  await updatePayoutApprovalStatus(organizationId, payoutId, {
    approvalStatus: 'rejected',
    status: 'failed',
    rejectedByUserId: rejectingUserId,
    rejectedAt: new Date(),
    rejectionReason: reason || undefined,
  });

  return { success: true };
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
