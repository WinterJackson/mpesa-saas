import { prisma } from '@/lib/db';

export type DarajaCommandType = 'transaction_status' | 'account_balance' | 'reversal';

export async function createDarajaCommand(
  organizationId: string,
  data: {
    type: DarajaCommandType;
    environment: string;
    originatorConversationId: string;
    conversationId?: string | null;
    targetReceipt?: string | null;
    targetPayoutId?: string | null;
  }
) {
  return prisma.darajaCommand.create({
    data: {
      organizationId,
      type: data.type,
      environment: data.environment,
      originatorConversationId: data.originatorConversationId,
      conversationId: data.conversationId ?? null,
      targetReceipt: data.targetReceipt ?? null,
      targetPayoutId: data.targetPayoutId ?? null,
    },
  });
}

export async function listDarajaCommands(organizationId: string, opts: { take?: number } = {}) {
  return prisma.darajaCommand.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 50,
  });
}

// Callback-correlation (NOT org-scoped) — the async result carries only the
// unique originatorConversationId.
export async function findDarajaCommandByOriginatorId(originatorConversationId: string) {
  return prisma.darajaCommand.findUnique({ where: { originatorConversationId } });
}

export async function applyDarajaCommandResult(
  id: string,
  data: { status: string; resultCode: number | null; resultDesc: string | null }
) {
  return prisma.darajaCommand.update({
    where: { id },
    data: { status: data.status, resultCode: data.resultCode, resultDesc: data.resultDesc },
  });
}
