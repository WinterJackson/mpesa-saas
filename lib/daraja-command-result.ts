import {
  findDarajaCommandByOriginatorId,
  applyDarajaCommandResult,
} from '@/lib/repositories/daraja-commands';
import type { DarajaResult, DarajaResultPayload } from '@/lib/types';
import { logger } from '@/lib/logger';

interface CommandRow {
  id: string;
  organizationId: string;
  environment: string;
  type: string;
  status: string;
  targetPayoutId: string | null;
}

/**
 * Shared core for the initiator-command result callbacks (Transaction Status,
 * Account Balance, Reversal). Correlates by originatorConversationId, applies
 * idempotent terminal-state handling, records the outcome on the DarajaCommand,
 * and runs an optional side effect. Never throws (callers always return 200).
 */
export async function processCommandResult(
  body: DarajaResultPayload,
  opName: string,
  sideEffect?: (command: CommandRow, result: DarajaResult, status: 'completed' | 'failed') => Promise<void>
): Promise<void> {
  const result = body?.Result;
  if (!result || !result.OriginatorConversationID) {
    logger.error(`[${opName} Result] Invalid payload — missing Result/OriginatorConversationID`);
    return;
  }

  const command = await findDarajaCommandByOriginatorId(result.OriginatorConversationID);
  if (!command) {
    logger.warn(`[${opName} Result] No command for OriginatorConversationID ${result.OriginatorConversationID}`);
    return;
  }
  if (command.status === 'completed' || command.status === 'failed') {
    logger.info(`[${opName} Result] Command ${command.id} already terminal (${command.status}). Skipping.`);
    return;
  }

  const status: 'completed' | 'failed' = result.ResultCode === 0 ? 'completed' : 'failed';
  await applyDarajaCommandResult(command.id, { status, resultCode: result.ResultCode, resultDesc: result.ResultDesc });

  if (sideEffect) {
    try {
      await sideEffect(command, result, status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`[${opName} Result] Side-effect error for command ${command.id}: ${msg}`);
    }
  }

  logger.info(`[${opName} Result] Command ${command.id} → ${status} (ResultCode ${result.ResultCode})`);
}

/** Minimal shared handler for the QueueTimeout callbacks — log, leave pending. */
export async function logCommandTimeout(body: DarajaResultPayload, opName: string): Promise<void> {
  const originator = body?.Result?.OriginatorConversationID;
  logger.warn(`[${opName} Timeout] Queue timeout (Originator ${originator ?? 'unknown'}) — left pending for reconciliation.`);
}
