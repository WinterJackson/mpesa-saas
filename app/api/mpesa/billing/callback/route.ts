import { NextResponse, after } from 'next/server';
import {
  findInvoiceByCheckoutRequestId,
  markInvoicePaidViaMpesa,
  markInvoiceChargeFailed,
  setSubscriptionStatus,
} from '@/lib/repositories/billing';
import { DUNNING, attemptsRemaining } from '@/lib/billing/dunning';
import { notifyInvoicePaid, notifyInvoicePaymentFailed } from '@/lib/email/notifications';
import type { DarajaCallbackPayload, DarajaCallbackMetadataItem } from '@/lib/types';
import { logger } from '@/lib/logger';

/**
 * PaySwift SUBSCRIPTION-BILLING STK callback.
 *
 * This is the sole writer of a subscription invoice's terminal payment status —
 * mirroring app/api/mpesa/callback (merchant transactions) and the B2C result
 * callback. Safaricom posts here for the platform billing collector's STK pushes
 * (correlated by CheckoutRequestID). It is deliberately SEPARATE from the merchant
 * STK callback: that one writes Transaction rows for a merchant's own collections;
 * this one settles PaySwift's own subscription invoices.
 *
 * Unlike querySTKPushStatus (guardrail #4), an STK CALLBACK is authoritative for
 * BOTH outcomes: ResultCode 0 = paid; any non-zero = this attempt failed (the
 * merchant cancelled, timed out, insufficient funds, etc.) and dunning may retry.
 * Always returns 200 so Safaricom does not retry-storm.
 */
export async function POST(request: Request) {
  try {
    let body: DarajaCallbackPayload;
    try {
      body = await request.json();
    } catch {
      logger.error('[BillingCallback] Failed to parse body as JSON');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback || !stkCallback.CheckoutRequestID) {
      logger.error('[BillingCallback] Invalid payload — missing CheckoutRequestID');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    const invoice = await findInvoiceByCheckoutRequestId(CheckoutRequestID);
    if (!invoice) {
      logger.warn(`[BillingCallback] No invoice for CheckoutRequestID: ${CheckoutRequestID}`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Idempotent: a settled invoice is never reopened by a duplicate callback.
    if (invoice.status === 'paid') {
      logger.info(`[BillingCallback] Invoice ${invoice.id} already paid. Skipping.`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const { subscription } = invoice;

    if (ResultCode === 0) {
      // ── Success: settle the invoice and (re)activate the subscription ──
      let mpesaReceipt: string | null = null;
      if (Array.isArray(CallbackMetadata?.Item)) {
        const receipt = CallbackMetadata.Item.find(
          (item: DarajaCallbackMetadataItem) => item.Name === 'MpesaReceiptNumber'
        );
        if (receipt?.Value) mpesaReceipt = String(receipt.Value);
      }

      await markInvoicePaidViaMpesa(invoice.id, mpesaReceipt);
      // Clear any dunning state — payment recovered.
      await setSubscriptionStatus(subscription.id, 'active', null);
      logger.info(`[BillingCallback] Invoice ${invoice.id} PAID (receipt ${mpesaReceipt ?? 'n/a'})`);

      after(() => notifyInvoicePaid(subscription.organizationId, invoice.amount));
    } else {
      // ── Failure: mark this attempt failed and enter/extend the grace window ──
      await markInvoiceChargeFailed(invoice.id, ResultDesc ?? `ResultCode ${ResultCode}`);
      // First failure moves the subscription to past_due with a grace period;
      // subsequent failures keep the existing window (don't push it out).
      if (subscription.status === 'active' || subscription.gracePeriodEnd === null) {
        await setSubscriptionStatus(
          subscription.id,
          'past_due',
          new Date(Date.now() + DUNNING.GRACE_PERIOD_MS)
        );
      }
      logger.info(`[BillingCallback] Invoice ${invoice.id} charge FAILED (ResultCode ${ResultCode})`);

      // attemptCount was incremented when the charge was sent, so it reflects
      // attempts made; remaining tells the merchant whether we'll auto-retry.
      after(() =>
        notifyInvoicePaymentFailed(
          subscription.organizationId,
          invoice.amount,
          attemptsRemaining(invoice.attemptCount)
        )
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[BillingCallback Error]:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
