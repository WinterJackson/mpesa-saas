'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { updateBillingDetails, getLatestUnpaidInvoiceForOrg } from '@/lib/repositories/billing';
import { chargeInvoice } from '@/lib/billing/subscription-billing';
import { requireRole } from '@/lib/rbac';
import { validatePhone } from '@/lib/validation';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export type BillingActionResult = { success: boolean; message: string };

/** Roles allowed to manage billing (developer is deliberately excluded). */
const BILLING_ROLES = ['owner', 'admin', 'finance'] as const;

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
