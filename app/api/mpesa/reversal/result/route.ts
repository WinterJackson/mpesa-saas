import { NextResponse } from 'next/server';
import { processCommandResult } from '@/lib/daraja-command-result';
import { applyPayoutResult } from '@/lib/repositories/payouts';
import type { DarajaResultPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

// Reversal result — on success, flips the originating Payout to 'reversed'.
export async function POST(request: Request) {
  try {
    let body: DarajaResultPayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    await processCommandResult(body, 'Reversal', async (command, result, status) => {
      if (status !== 'completed' || !command.targetPayoutId) return;
      await applyPayoutResult(command.targetPayoutId, {
        status: 'reversed',
        resultCode: result.ResultCode,
        resultDesc: result.ResultDesc,
        mpesaReceipt: null,
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Reversal Result Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
