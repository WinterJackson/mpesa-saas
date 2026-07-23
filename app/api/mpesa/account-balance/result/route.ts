import { NextResponse } from 'next/server';
import { processCommandResult } from '@/lib/daraja-command-result';
import { createBalanceSnapshot, parseWorkingBalance } from '@/lib/repositories/account-balance';
import { findResultParam, type DarajaResultPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

// Account Balance result — on success, snapshots the balance for ops alerting.
export async function POST(request: Request) {
  try {
    let body: DarajaResultPayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    await processCommandResult(body, 'Account Balance', async (command, result, status) => {
      if (status !== 'completed') return;
      const balanceRaw = findResultParam(result, 'AccountBalance');
      if (balanceRaw == null) return;
      const raw = String(balanceRaw);
      await createBalanceSnapshot(command.organizationId, {
        environment: command.environment,
        balanceRaw: raw,
        workingBalance: parseWorkingBalance(raw),
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Account Balance Result Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
