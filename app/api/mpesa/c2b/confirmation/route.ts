import { NextResponse } from 'next/server';
import { findOrgContextByShortcode } from '@/lib/repositories/daraja-credentials';
import { createC2BTransactionIfNew } from '@/lib/repositories/transactions';
import { finalizeTransactionAsync } from '@/lib/transaction-finalization';
import type { DarajaC2BPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

/**
 * Safaricom C2B Confirmation — fired AFTER a customer pays the Paybill/Till.
 * Records a completed Transaction (source 'c2b') attributed to the org that owns
 * the BusinessShortCode, then fires the payment.completed webhook. Idempotent on
 * the M-Pesa receipt (TransID). Always returns the Daraja-expected 200/accept.
 */
export async function POST(request: Request) {
  const ok = () => NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 });

  try {
    let body: DarajaC2BPayload;
    try {
      body = await request.json();
    } catch {
      logger.error('[C2B Confirmation] Failed to parse body as JSON');
      return ok();
    }

    const { TransID, TransAmount, BusinessShortCode, BillRefNumber, MSISDN } = body;
    if (!TransID || !BusinessShortCode || !MSISDN) {
      logger.error('[C2B Confirmation] Invalid payload:', JSON.stringify(body));
      return ok();
    }

    const context = await findOrgContextByShortcode(String(BusinessShortCode));
    if (!context) {
      logger.warn(`[C2B Confirmation] No org owns shortcode ${BusinessShortCode} (pooled sandbox shortcodes are not attributable). Skipping.`);
      return ok();
    }

    const amount = Math.round(Number(TransAmount));
    const created = await createC2BTransactionIfNew({
      organizationId: context.organizationId,
      merchantId: context.merchantId,
      environment: context.environment,
      amount,
      phone: String(MSISDN),
      mpesaReceipt: String(TransID),
      orderReference: BillRefNumber ? String(BillRefNumber) : null,
    });

    if (!created) {
      logger.info(`[C2B Confirmation] Duplicate confirmation for receipt ${TransID}. Skipping.`);
      return ok();
    }

    finalizeTransactionAsync(created, created.merchant);
    logger.info(`[C2B Confirmation] Recorded C2B transaction ${created.id} (receipt ${TransID}, org ${context.organizationId})`);
    return ok();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[C2B Confirmation Processing Error]:', message);
    // Still return accept — Safaricom retries on non-200, and the payment already happened.
    return ok();
  }
}
