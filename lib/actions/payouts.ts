'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { findTransactionById } from '@/lib/repositories/transactions';
import { createAndInitiatePayout, createAndInitiateRefund } from '@/lib/payouts';
import { validatePhone, validateAmount } from '@/lib/validation';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export type PayoutActionResult = { success: boolean; message: string };

/** Roles allowed to move money out (send payouts / issue refunds). */
const PAYOUT_ROLES = ['owner', 'admin', 'finance'] as const;

/**
 * Sends money to a phone (B2C payout) from the dashboard. Reuses the same
 * createAndInitiatePayout orchestration as the v1 API — NOT a second money path.
 * Terminal status is still written only by the B2C result callback.
 */
export async function sendPayoutAction(input: {
  phone: string;
  amount: number | string;
  remarks?: string;
}): Promise<PayoutActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { success: false, message: 'Not signed in.' };

  const context = await getOrganizationContext(userId, orgId);
  if (!context || !context.merchant) return { success: false, message: 'Organization not found.' };

  const rbac = await requireRole(context.organization.id, userId, [...PAYOUT_ROLES]);
  if (!rbac.allowed) return { success: false, message: rbac.error };

  const phoneCheck = validatePhone(String(input.phone ?? ''));
  if (!phoneCheck.valid) return { success: false, message: phoneCheck.error ?? 'Invalid phone number.' };

  const amountCheck = validateAmount(input.amount);
  if (!amountCheck.valid) return { success: false, message: amountCheck.error ?? 'Invalid amount.' };

  const remarks = input.remarks?.trim() ? input.remarks.trim().slice(0, 100) : null;

  const result = await createAndInitiatePayout({
    organizationId: context.organization.id,
    merchantId: context.merchant.id,
    environment: context.merchant.environment as 'sandbox' | 'live',
    amount: amountCheck.sanitized!,
    phone: phoneCheck.sanitized!,
    remarks,
  });

  if (!result.success) {
    logger.error('[payouts] sendPayout failed', result.error);
    return { success: false, message: friendlyGatewayError(result.error) };
  }

  await writeAuditLog({
    organizationId: context.organization.id,
    actorId: userId,
    action: 'payout.initiated',
    metadata: { payoutId: result.payoutId, amount: amountCheck.sanitized },
  });

  revalidatePath('/payouts');
  return { success: true, message: 'Payout sent — it will show as completed once M-Pesa confirms.' };
}

/**
 * Refunds a completed transaction (B2C back to the customer) from the dashboard.
 * Reuses createAndInitiateRefund; the customer phone comes from the original
 * transaction, never client input.
 */
export async function refundTransactionAction(input: {
  transactionId: string;
  amount?: number | string;
  reason?: string;
}): Promise<PayoutActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { success: false, message: 'Not signed in.' };

  const context = await getOrganizationContext(userId, orgId);
  if (!context || !context.merchant) return { success: false, message: 'Organization not found.' };

  const rbac = await requireRole(context.organization.id, userId, [...PAYOUT_ROLES]);
  if (!rbac.allowed) return { success: false, message: rbac.error };

  if (typeof input.transactionId !== 'string' || !input.transactionId) {
    return { success: false, message: 'A transaction is required.' };
  }

  const transaction = await findTransactionById(context.organization.id, input.transactionId);
  if (!transaction) return { success: false, message: 'Transaction not found.' };
  if (transaction.status !== 'completed') {
    return { success: false, message: 'Only completed payments can be refunded.' };
  }

  // Default to a full refund; a partial amount must not exceed the original.
  let refundAmount = transaction.amount;
  if (input.amount !== undefined && input.amount !== '') {
    const amountCheck = validateAmount(input.amount);
    if (!amountCheck.valid) return { success: false, message: amountCheck.error ?? 'Invalid amount.' };
    if (amountCheck.sanitized! > transaction.amount) {
      return { success: false, message: 'Refund amount cannot exceed the original payment.' };
    }
    refundAmount = amountCheck.sanitized!;
  }

  const reason = input.reason?.trim() ? input.reason.trim().slice(0, 100) : null;

  const result = await createAndInitiateRefund({
    organizationId: context.organization.id,
    merchantId: context.merchant.id,
    transactionId: transaction.id,
    environment: context.merchant.environment as 'sandbox' | 'live',
    amount: refundAmount,
    phone: transaction.phone,
    reason,
  });

  if (!result.success) {
    logger.error('[payouts] refund failed', result.error);
    return { success: false, message: friendlyGatewayError(result.error) };
  }

  await writeAuditLog({
    organizationId: context.organization.id,
    actorId: userId,
    action: 'refund.initiated',
    metadata: { refundId: result.refundId, transactionId: transaction.id, amount: refundAmount },
  });

  revalidatePath('/payouts');
  return { success: true, message: 'Refund sent — it will show as completed once M-Pesa confirms.' };
}

/** Turns raw gateway/credential errors into merchant-friendly guidance. */
function friendlyGatewayError(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes('credential') || lower.includes('initiator') || lower.includes('security')) {
    return 'Payouts need your B2C initiator credentials configured. Add them in Settings, or contact support if you have gone live.';
  }
  return 'We couldn’t start this money transfer. Please try again in a moment.';
}
