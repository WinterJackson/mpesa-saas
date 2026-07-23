import { NextResponse } from 'next/server';
import { findPayoutByOriginatorId } from '@/lib/repositories/payouts';
import { findRefundByOriginatorId } from '@/lib/repositories/refunds';
import type { DarajaResultPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

/**
 * Safaricom B2C QueueTimeout callback — fired when the request times out inside
 * Daraja's queue before reaching M-Pesa. We do NOT mark the payout/refund failed
 * from a timeout alone (the actual result may still arrive at the Result URL, and
 * asymmetric-trust discipline says a timeout is not a definitive failure). We log
 * for ops visibility and leave the record pending so reconciliation (Stage 8) can
 * resolve it. Always returns 200.
 */
export async function POST(request: Request) {
  try {
    let body: DarajaResultPayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const originatorId = body?.Result?.OriginatorConversationID;
    if (originatorId) {
      const payout = await findPayoutByOriginatorId(originatorId);
      const refund = payout ? null : await findRefundByOriginatorId(originatorId);
      const ref = payout?.id ?? refund?.id ?? 'unknown';
      logger.warn(`[B2C Timeout] Queue timeout for ${payout ? 'payout' : refund ? 'refund' : 'unknown'} ${ref} (Originator ${originatorId}) — left pending for reconciliation.`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[B2C Timeout Processing Error]:', message);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
