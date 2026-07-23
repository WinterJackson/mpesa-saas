import { NextResponse } from 'next/server';
import { findPayoutByOriginatorId, applyPayoutResult } from '@/lib/repositories/payouts';
import { findRefundByOriginatorId, applyRefundResult } from '@/lib/repositories/refunds';
import { finalizePayoutAsync, finalizeRefundAsync } from '@/lib/payout-finalization';
import { findResultParam, type DarajaResultPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

/**
 * Safaricom B2C Result callback — the DEFINITIVE async outcome of a payout/refund
 * and the SOLE writer of their terminal status (mirrors the STK callback's
 * authority). Unlike querySTKPushStatus (guardrail #4), this authoritative
 * push CAN mark failure. No auth (Safaricom raw POST); always returns 200 to
 * avoid retry storms; correlates by OriginatorConversationID.
 */
export async function POST(request: Request) {
  try {
    let body: DarajaResultPayload;
    try {
      body = await request.json();
    } catch {
      logger.error('[B2C Result] Failed to parse body as JSON');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const result = body?.Result;
    if (!result || !result.OriginatorConversationID) {
      logger.error('[B2C Result] Invalid payload — missing Result/OriginatorConversationID:', JSON.stringify(body));
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const { OriginatorConversationID, ResultCode, ResultDesc } = result;
    const status = ResultCode === 0 ? 'completed' : 'failed';
    const mpesaReceipt =
      ResultCode === 0
        ? (result.TransactionID ?? (findResultParam(result, 'TransactionReceipt') as string | undefined) ?? null)
        : null;

    // Resolve whether this correlates to a Payout or a Refund.
    const payout = await findPayoutByOriginatorId(OriginatorConversationID);
    if (payout) {
      if (payout.status === 'completed' || payout.status === 'failed') {
        logger.info(`[B2C Result] Payout ${payout.id} already terminal (${payout.status}). Skipping.`);
        return NextResponse.json({ success: true }, { status: 200 });
      }
      const updated = await applyPayoutResult(payout.id, { status, resultCode: ResultCode, resultDesc: ResultDesc, mpesaReceipt });
      finalizePayoutAsync(updated, payout.merchant);
      logger.info(`[B2C Result] Payout ${payout.id} → ${status} (ResultCode ${ResultCode})`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const refund = await findRefundByOriginatorId(OriginatorConversationID);
    if (refund) {
      if (refund.status === 'completed' || refund.status === 'failed') {
        logger.info(`[B2C Result] Refund ${refund.id} already terminal (${refund.status}). Skipping.`);
        return NextResponse.json({ success: true }, { status: 200 });
      }
      const updated = await applyRefundResult(refund.id, { status, resultCode: ResultCode, resultDesc: ResultDesc, mpesaReceipt });
      finalizeRefundAsync(updated, refund.merchant);
      logger.info(`[B2C Result] Refund ${refund.id} → ${status} (ResultCode ${ResultCode})`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    logger.warn(`[B2C Result] No payout/refund for OriginatorConversationID ${OriginatorConversationID}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[B2C Result Processing Error]:', message);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
