'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import {
  updateBillingDetails,
  getLatestUnpaidInvoiceForOrg,
  getSubscriptionForOrganization,
  getPlanByName,
  createInvoice,
  updateSubscriptionPlan,
  isSelfServePlanName,
} from '@/lib/repositories/billing';
import { chargeInvoice } from '@/lib/billing/subscription-billing';
import { requireRole } from '@/lib/rbac';
import { validatePhone } from '@/lib/validation';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export type BillingActionResult = { success: boolean; message: string };

/** Roles allowed to manage billing (developer is deliberately excluded). */
const BILLING_ROLES = ['owner', 'admin', 'finance'] as const;

function kes(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`;
}

/**
 * Saves the org's billing M-Pesa number + billing contact email. The M-Pesa
 * number is the phone charged for the subscription (STK Push), normalized to
 * 2547XXXXXXXX. Owner/admin/finance only.
 */
export async function saveBillingDetailsAction(input: {
  billingMpesaPhone: string;
  billingContactEmail: string;
}): Promise<BillingActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { success: false, message: 'Not signed in.' };

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return { success: false, message: 'Organization not found.' };

  const rbac = await requireRole(context.organization.id, userId, [...BILLING_ROLES]);
  if (!rbac.allowed) return { success: false, message: rbac.error };

  const phoneRaw = input.billingMpesaPhone?.trim() ?? '';
  const emailRaw = input.billingContactEmail?.trim() ?? '';

  let billingMpesaPhone: string | null = null;
  if (phoneRaw) {
    const check = validatePhone(phoneRaw);
    if (!check.valid) return { success: false, message: check.error ?? 'Invalid phone number.' };
    billingMpesaPhone = check.sanitized ?? null;
  }

  let billingContactEmail: string | null = null;
  if (emailRaw) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
      return { success: false, message: 'Invalid email address.' };
    }
    billingContactEmail = emailRaw;
  }

  try {
    await updateBillingDetails(context.organization.id, { billingMpesaPhone, billingContactEmail });
    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'billing.details_updated',
      // Only record WHICH fields changed — never the values (PII/phone).
      metadata: { fields: ['billingMpesaPhone', 'billingContactEmail'] },
    });
    revalidatePath('/billing');
    return { success: true, message: 'Billing details saved.' };
  } catch (error) {
    logger.error('[billing] saveBillingDetails failed', error);
    return { success: false, message: 'Could not save billing details. Please try again.' };
  }
}

/**
 * Manually triggers an STK Push for the org's outstanding invoice ("Pay now").
 * Reuses the same fire-safe chargeInvoice the dunning flow uses; terminal status
 * is still written only by the billing callback.
 */
export async function payNowAction(): Promise<BillingActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { success: false, message: 'Not signed in.' };

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return { success: false, message: 'Organization not found.' };

  const rbac = await requireRole(context.organization.id, userId, [...BILLING_ROLES]);
  if (!rbac.allowed) return { success: false, message: rbac.error };

  const invoice = await getLatestUnpaidInvoiceForOrg(context.organization.id);
  if (!invoice) return { success: false, message: 'You have no outstanding invoice to pay.' };

  const result = await chargeInvoice(invoice);
  if (result.charged) {
    revalidatePath('/billing');
    return { success: true, message: 'Check your phone — enter your M-Pesa PIN to complete payment.' };
  }

  const reasons: Record<string, string> = {
    no_billing_phone: 'Add a billing M-Pesa number first, then try again.',
    platform_unconfigured: 'Subscription payments are not available just yet. Please try again later.',
    already_processing: 'A payment prompt is already in progress. Check your phone.',
    stk_error: 'We couldn’t start the payment. Please try again in a moment.',
  };
  return { success: false, message: reasons[result.reason] ?? 'Could not start payment.' };
}

/**
 * Self-service plan change (upgrade / downgrade / switch). Owner/admin/finance
 * only. Switching to the FREE tier (Starter) activates immediately with no
 * charge. Switching to a PAID plan issues a fresh first-period invoice and:
 *  - keeps access if the org is already an active paying subscriber, or
 *  - moves it to `incomplete` (pay-first) if it was free/unpaid/suspended.
 * It then best-effort fires the STK prompt when a billing phone is on file; the
 * billing STK callback remains the SOLE writer of the invoice's terminal status.
 */
export async function changePlanAction(planName: string): Promise<BillingActionResult> {
  const { userId, orgId } = await auth();
  if (!userId) return { success: false, message: 'Not signed in.' };

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return { success: false, message: 'Organization not found.' };

  const rbac = await requireRole(context.organization.id, userId, [...BILLING_ROLES]);
  if (!rbac.allowed) return { success: false, message: rbac.error };

  if (!isSelfServePlanName(planName)) {
    return { success: false, message: 'That plan isn’t self-service — contact sales.' };
  }

  const subscription = await getSubscriptionForOrganization(context.organization.id);
  if (!subscription) return { success: false, message: 'No subscription found for this organization.' };
  if (subscription.plan.name === planName) {
    return { success: false, message: `You’re already on the ${planName} plan.` };
  }

  const target = await getPlanByName(planName);
  if (!target) return { success: false, message: 'That plan is unavailable right now.' };

  try {
    // ── Switch to the FREE tier → immediate, no payment ──
    if (target.monthlyFee === 0) {
      await updateSubscriptionPlan(subscription.id, target.id, 'active', null);
      await writeAuditLog({
        organizationId: context.organization.id,
        actorId: userId,
        action: 'billing.plan_changed',
        metadata: { from: subscription.plan.name, to: target.name },
      });
      revalidatePath('/billing');
      revalidatePath('/dashboard');
      return { success: true, message: `Switched to ${target.name}. It’s active now.` };
    }

    // ── Switch to a PAID plan → apply plan + issue a fresh first-period invoice ──
    // Keep access if they were already an active payer; otherwise require payment.
    const wasActivePayer = subscription.status === 'active' && subscription.plan.monthlyFee > 0;
    await updateSubscriptionPlan(
      subscription.id,
      target.id,
      wasActivePayer ? 'active' : 'incomplete',
      null
    );
    await createInvoice(subscription.id, target.monthlyFee);
    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'billing.plan_changed',
      metadata: { from: subscription.plan.name, to: target.name },
    });

    // Best-effort: fire the STK now if a billing number is on file.
    const invoice = await getLatestUnpaidInvoiceForOrg(context.organization.id);
    const charge = invoice ? await chargeInvoice(invoice) : null;

    revalidatePath('/billing');
    revalidatePath('/dashboard');

    if (charge?.charged) {
      return {
        success: true,
        message: `Switched to ${target.name}. Check your phone — enter your M-Pesa PIN to pay ${kes(target.monthlyFee)}.`,
      };
    }
    if (charge && charge.reason === 'no_billing_phone') {
      return {
        success: true,
        message: `Switched to ${target.name}. Add your billing M-Pesa number below, then tap Pay now to activate it.`,
      };
    }
    return {
      success: true,
      message: `Switched to ${target.name}. Use “Pay now” to complete the ${kes(target.monthlyFee)} payment and activate it.`,
    };
  } catch (error) {
    logger.error('[billing] changePlan failed', error);
    return { success: false, message: 'Could not change your plan. Please try again.' };
  }
}
