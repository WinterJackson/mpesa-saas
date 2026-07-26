import { NextResponse } from 'next/server';
import { processCommandResult } from '@/lib/daraja-command-result';
import { createBalanceSnapshot, latestBalanceSnapshot, parseWorkingBalance } from '@/lib/repositories/account-balance';
import { findOrganizationById, resolveLowBalanceThreshold } from '@/lib/repositories/organizations';
import { notifyLowBalance } from '@/lib/email/notifications';
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
      const workingBalance = parseWorkingBalance(raw);

      // Check the transition BEFORE writing the new snapshot, and only for live —
      // sandbox balance fluctuation during testing isn't an operational concern.
      if (command.environment === 'live' && workingBalance != null) {
        const org = await findOrganizationById(command.organizationId);
        if (org) {
          const threshold = resolveLowBalanceThreshold(org);
          const previous = await latestBalanceSnapshot(command.organizationId);
          // no prior snapshot should NOT trigger an alert on the very first-ever check
          // so we only trigger if previous existed AND was >= threshold
          const wasAboveThreshold = previous?.workingBalance != null && previous.workingBalance >= threshold;
          if (workingBalance < threshold && wasAboveThreshold) {
            await notifyLowBalance(command.organizationId, workingBalance, threshold);
          }
        }
      }

      await createBalanceSnapshot(command.organizationId, {
        environment: command.environment,
        balanceRaw: raw,
        workingBalance,
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Account Balance Result Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
