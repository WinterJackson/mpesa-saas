import {
  attachInvoiceCharge,
  markInvoiceChargeFailed,
  listInvoicesForDunning,
  setSubscriptionStatus,
} from '@/lib/repositories/billing';
import { initiateBillingStkPush, isPlatformBillingConfigured } from '@/lib/billing/platform-mpesa';
import { decideDunningAction, DUNNING } from '@/lib/billing/dunning';
import { notifySubscriptionSuspended } from '@/lib/email/notifications';
import { logger } from '@/lib/logger';

/** Minimal shape chargeInvoice needs — satisfied by both the dunning list and a fresh invoice. */
export interface ChargeableInvoice {
  id: string;
  amount: number;
  subscription: { organization: { billingMpesaPhone: string | null } };
}

export type ChargeResult =
  | { charged: true; checkoutRequestId: string }
  | { charged: false; reason: 'no_billing_phone' | 'platform_unconfigured' | 'already_processing' | 'stk_error' };

/**
 * Attempts a single STK charge for an invoice. NEVER throws — every failure path
 * returns a typed reason so the caller (cron/manual Pay-now) can react without a
 * try/catch. A gateway error marks the invoice `failed` so dunning can retry.
 */
export async function chargeInvoice(invoice: ChargeableInvoice): Promise<ChargeResult> {
  const org = invoice.subscription.organization;
  const phone = org.billingMpesaPhone;

  if (!phone) return { charged: false, reason: 'no_billing_phone' };
  if (!isPlatformBillingConfigured()) return { charged: false, reason: 'platform_unconfigured' };

  try {
    const stk = await initiateBillingStkPush({
      phone,
      amount: invoice.amount,
      accountReference: `SUB-${invoice.id.slice(-6)}`,
      transactionDesc: 'Subscription',
    });
    const count = await attachInvoiceCharge(invoice.id, stk.checkoutRequestId);
    if (count === 0) return { charged: false, reason: 'already_processing' };
    logger.info(`[Billing] STK charge sent for invoice ${invoice.id}${stk.isSandboxFallback ? ' (sandbox)' : ''}`);
    return { charged: true, checkoutRequestId: stk.checkoutRequestId };
  } catch (error) {
    await markInvoiceChargeFailed(invoice.id, error instanceof Error ? error.message : 'charge error');
    return { charged: false, reason: 'stk_error' };
  }
}

export interface DunningSummary {
  considered: number;
  charged: number;
  suspended: number;
  waiting: number;
  skipped: number;
}

/**
 * Runs one dunning pass over every open invoice: (re)charges those due, soft-locks
 * subscriptions whose grace window has elapsed with retries exhausted, and leaves
 * the rest for a later cycle. Idempotent and safe to run on a schedule — the
 * per-invoice conditional updates prevent double-charging. Terminal payment
 * status is still written ONLY by the billing callback, never here.
 */
export async function runDunningCycle(now: Date = new Date()): Promise<DunningSummary> {
  const invoices = await listInvoicesForDunning();
  const summary: DunningSummary = { considered: invoices.length, charged: 0, suspended: 0, waiting: 0, skipped: 0 };

  for (const invoice of invoices) {
    const action = decideDunningAction(invoice, invoice.subscription, now);

    if (action === 'charge') {
      // The billing callback notifies the merchant on each failure (the
      // authoritative event); the runner just (re)sends the STK prompt.
      const result = await chargeInvoice(invoice);
      if (result.charged) summary.charged++;
      else summary.skipped++;
    } else if (action === 'suspend') {
      await setSubscriptionStatus(invoice.subscription.id, 'suspended');
      void notifySubscriptionSuspended(invoice.subscription.organizationId, invoice.amount);
      logger.info(`[Billing] Subscription ${invoice.subscription.id} suspended after ${invoice.attemptCount} failed attempts`);
      summary.suspended++;
    } else {
      summary.waiting++;
    }
  }

  return summary;
}

export { DUNNING };
