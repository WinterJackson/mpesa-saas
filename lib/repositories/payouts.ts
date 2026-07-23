import { prisma } from '@/lib/db';
import type { B2CCommandID } from '@/lib/daraja-b2c';

export interface PayoutRow {
  id: string;
  amount: number;
  phone: string;
  commandId: string;
  status: string;
  mpesaReceipt: string | null;
  resultDesc: string | null;
  environment: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function createPayout(
  organizationId: string,
  data: {
    merchantId: string;
    amount: number;
    phone: string;
    commandId?: B2CCommandID;
    remarks?: string | null;
    occasion?: string | null;
    environment: string;
  }
) {
  return prisma.payout.create({
    data: {
      organizationId,
      merchantId: data.merchantId,
      amount: data.amount,
      phone: data.phone,
      commandId: data.commandId ?? 'BusinessPayment',
      remarks: data.remarks ?? null,
      occasion: data.occasion ?? null,
      environment: data.environment,
      status: 'pending',
    },
  });
}

export async function findPayoutById(organizationId: string, id: string) {
  return prisma.payout.findFirst({ where: { id, organizationId } });
}

export async function listPayouts(organizationId: string, opts: { take?: number } = {}) {
  return prisma.payout.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 50,
  });
}

/**
 * Persists Daraja's sync-response correlation ids after initiation. Scoped by
 * organizationId for defense-in-depth even though `id` is unique.
 */
export async function setPayoutInitiation(
  organizationId: string,
  id: string,
  data: { conversationId: string; originatorConversationId: string }
) {
  return prisma.payout.updateMany({
    where: { id, organizationId },
    data: { conversationId: data.conversationId, originatorConversationId: data.originatorConversationId },
  });
}

export async function markPayoutFailedOnInitiation(organizationId: string, id: string, resultDesc: string) {
  return prisma.payout.updateMany({
    where: { id, organizationId },
    data: { status: 'failed', resultDesc },
  });
}

// ─── Callback-correlation (NOT org-scoped) ──────────────────────────────────
// The async B2C result callback carries no org context; it correlates by the
// globally-unique originatorConversationId, mirroring how the STK callback
// finds a transaction by its unique checkoutRequestId.

/** Admin (platform) payout lookup — deliberately NOT org-scoped. */
export async function adminFindPayoutById(id: string) {
  return prisma.payout.findUnique({ where: { id } });
}

export async function findPayoutByOriginatorId(originatorConversationId: string) {
  return prisma.payout.findUnique({
    where: { originatorConversationId },
    include: { merchant: true },
  });
}

export async function applyPayoutResult(
  id: string,
  data: { status: string; resultCode: number | null; resultDesc: string | null; mpesaReceipt: string | null }
) {
  return prisma.payout.update({
    where: { id },
    data: {
      status: data.status,
      resultCode: data.resultCode,
      resultDesc: data.resultDesc,
      ...(data.mpesaReceipt ? { mpesaReceipt: data.mpesaReceipt } : {}),
    },
  });
}
