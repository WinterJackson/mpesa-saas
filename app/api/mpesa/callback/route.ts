import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { finalizeTransactionAsync } from '@/lib/transaction-finalization';
import type { DarajaCallbackPayload, DarajaCallbackMetadataItem } from '@/lib/types';
import { mapResultCodeToStatus } from '@/lib/mpesa-status';
import { logger } from '@/lib/logger';

/**
 * Safaricom STK Push Callback Endpoint.
 *
 * NO authentication — Safaricom sends a raw POST to this endpoint.
 * Security is enforced through:
 *   1. Unique CheckoutRequestID lookup (only valid transactions are processed)
 *   2. Idempotency guard (already-processed transactions are ignored)
 *   3. Always returning 200 OK (prevents Safaricom retry storms)
 *
 * Official Daraja 2026 Callback Payload:
 * {
 *   "Body": {
 *     "stkCallback": {
 *       "MerchantRequestID": "...",
 *       "CheckoutRequestID": "ws_CO_...",
 *       "ResultCode": 0,
 *       "ResultDesc": "The service request is processed successfully.",
 *       "CallbackMetadata": {
 *         "Item": [
 *           { "Name": "Amount", "Value": 100 },
 *           { "Name": "MpesaReceiptNumber", "Value": "QHJ7XXXXXXXX" },
 *           { "Name": "Balance" },
 *           { "Name": "TransactionDate", "Value": 20260716114700 },
 *           { "Name": "PhoneNumber", "Value": 254712345678 }
 *         ]
 *       }
 *     }
 *   }
 * }
 *
 * On failure/cancellation, CallbackMetadata is absent:
 * { "Body": { "stkCallback": { "ResultCode": 1032, "ResultDesc": "Request cancelled by user" } } }
 */
export async function POST(request: Request) {
  try {
    let body: DarajaCallbackPayload;
    try {
      body = await request.json();
    } catch {
      logger.error('[Callback] Failed to parse request body as JSON');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Validate payload shape
    const stkCallback = body?.Body?.stkCallback;

    if (!stkCallback || !stkCallback.CheckoutRequestID) {
      logger.error('[Callback] Invalid payload shape — missing stkCallback or CheckoutRequestID:', JSON.stringify(body));
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stkCallback;

    // ── 1. Idempotency Check ──────────────────────────────────────────────────
    // Find the transaction and its merchant (needed for webhook delivery)
    const transaction = await prisma.transaction.findUnique({
      where: { checkoutRequestId: CheckoutRequestID },
      include: { merchant: true },
    });

    if (!transaction) {
      logger.warn(`[Callback] No transaction found for CheckoutRequestID: ${CheckoutRequestID}`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // If already in a terminal state, return immediately (idempotent)
    if (transaction.status === 'completed' || transaction.status === 'cancelled' || transaction.status === 'failed') {
      logger.info(`[Callback] Transaction ${transaction.id} already in terminal state "${transaction.status}". Skipping.`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── 2. Map ResultCode to Status ───────────────────────────────────────────
    // ResultCode 0    = Success
    // ResultCode 1032 = Cancelled by user
    // ResultCode 1037 = DS timeout (user didn't enter PIN)
    // ResultCode 2001 = Wrong PIN
    // Anything else   = Failed
    const status: string = mapResultCodeToStatus(ResultCode);
    let mpesaReceipt: string | null = null;

    if (ResultCode === 0) {
      // Extract MpesaReceiptNumber from CallbackMetadata.Item[]
      if (CallbackMetadata?.Item && Array.isArray(CallbackMetadata.Item)) {
        const receiptItem = CallbackMetadata.Item.find(
          (item: DarajaCallbackMetadataItem) => item.Name === 'MpesaReceiptNumber'
        );
        if (receiptItem?.Value) {
          mpesaReceipt = String(receiptItem.Value);
        }
      }
    }

    // ── 3. Update Transaction Atomically ──────────────────────────────────────
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        ...(mpesaReceipt ? { mpesaReceipt } : {}),
      },
    });

    logger.info(`[Callback] Transaction ${transaction.id} updated to "${status}" (ResultCode: ${ResultCode})`);

    // ── 4. Finalize Async (Webhooks & Shopify) ───────────────────────────────
    const { merchant } = transaction;
    finalizeTransactionAsync(updatedTransaction, merchant);

    // Safaricom ALWAYS needs 200 OK — even if our internal processing fails
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Callback Processing Error]:', message);
    // MUST return 200 to Safaricom even on internal errors to prevent retry storms
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
