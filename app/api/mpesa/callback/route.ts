import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/db';
import { deliverWebhook } from '@/lib/webhook';
import type { DarajaCallbackPayload, DarajaCallbackMetadataItem } from '@/lib/types';

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
      console.error('[Callback] Failed to parse request body as JSON');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Validate payload shape
    const stkCallback = body?.Body?.stkCallback;

    if (!stkCallback || !stkCallback.CheckoutRequestID) {
      console.error('[Callback] Invalid payload shape — missing stkCallback or CheckoutRequestID:', JSON.stringify(body));
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
      console.warn(`[Callback] No transaction found for CheckoutRequestID: ${CheckoutRequestID}`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // If already in a terminal state, return immediately (idempotent)
    if (transaction.status === 'completed' || transaction.status === 'cancelled' || transaction.status === 'failed') {
      console.log(`[Callback] Transaction ${transaction.id} already in terminal state "${transaction.status}". Skipping.`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── 2. Map ResultCode to Status ───────────────────────────────────────────
    // ResultCode 0    = Success
    // ResultCode 1032 = Cancelled by user
    // ResultCode 1037 = DS timeout (user didn't enter PIN)
    // ResultCode 2001 = Wrong PIN
    // Anything else   = Failed
    let status: string;
    let mpesaReceipt: string | null = null;

    if (ResultCode === 0) {
      status = 'completed';

      // Extract MpesaReceiptNumber from CallbackMetadata.Item[]
      if (CallbackMetadata?.Item && Array.isArray(CallbackMetadata.Item)) {
        const receiptItem = CallbackMetadata.Item.find(
          (item: DarajaCallbackMetadataItem) => item.Name === 'MpesaReceiptNumber'
        );
        if (receiptItem?.Value) {
          mpesaReceipt = String(receiptItem.Value);
        }
      }
    } else if (ResultCode === 1032) {
      status = 'cancelled';
    } else {
      status = 'failed';
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

    console.log(`[Callback] Transaction ${transaction.id} updated to "${status}" (ResultCode: ${ResultCode})`);

    // ── 4. Outbound Webhook (Fire-and-Forget) ─────────────────────────────────
    // If the merchant has a webhook URL configured, deliver the event asynchronously.
    // We use .then()/.catch() instead of await so the 200 response returns immediately.
    const { merchant } = transaction;
    if (merchant.webhookUrl) {
      const webhookPayload = {
        event: `payment.${status}`,
        data: {
          transactionId: updatedTransaction.id,
          amount: updatedTransaction.amount,
          phone: updatedTransaction.phone,
          orderReference: updatedTransaction.orderReference,
          status: updatedTransaction.status,
          mpesaReceipt: updatedTransaction.mpesaReceipt,
          resultCode: updatedTransaction.resultCode,
          resultDesc: updatedTransaction.resultDesc,
          createdAt: updatedTransaction.createdAt,
          updatedAt: updatedTransaction.updatedAt,
        },
      };

      // Fire-and-forget background execution via Next.js after()
      // Guarantees execution completes in Vercel Serverless without blocking the 200 OK response
      after(async () => {
        try {
          const result = await deliverWebhook(merchant.webhookUrl!, webhookPayload, merchant.webhookSecret ?? undefined);
          if (!result.delivered) {
            console.warn(`[Callback Webhook] Delivery failed to ${merchant.webhookUrl} (HTTP ${result.statusCode})`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[Callback Webhook] Uncaught error for ${merchant.webhookUrl}: ${msg}`);
        }
      });
    }

    // Safaricom ALWAYS needs 200 OK — even if our internal processing fails
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Callback Processing Error]:', message);
    // MUST return 200 to Safaricom even on internal errors to prevent retry storms
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
