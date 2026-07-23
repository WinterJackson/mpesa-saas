import { prisma } from '@/lib/db';

export async function createRefund(
  organizationId: string,
  data: {
    merchantId: string;
    transactionId: string;
    amount: number;
    phone: string;
    reason?: string | null;
    environment: string;
  }
) {
  return prisma.refund.create({
    data: {
      organizationId,
      merchantId: data.merchantId,
      transactionId: data.transactionId,
      amount: data.amount,
      phone: data.phone,
      reason: data.reason ?? null,
      environment: data.environment,
      status: 'pending',
    },
  });
}

export async function findRefundById(organizationId: string, id: string) {
  return prisma.refund.findFirst({ where: { id, organizationId } });
}

export async function listRefunds(organizationId: string, opts: { take?: number } = {}) {
  return prisma.refund.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 50,
  });
}

export async function setRefundInitiation(
  organizationId: string,
  id: string,
  data: { conversationId: string; originatorConversationId: string }
) {
  return prisma.refund.updateMany({
    where: { id, organizationId },
    data: { conversationId: data.conversationId, originatorConversationId: data.originatorConversationId },
  });
}

export async function markRefundFailedOnInitiation(organizationId: string, id: string, resultDesc: string) {
  return prisma.refund.updateMany({
    where: { id, organizationId },
    data: { status: 'failed', resultDesc },
  });
}

// ─── Callback-correlation (NOT org-scoped; see payouts.ts note) ─────────────

export async function findRefundByOriginatorId(originatorConversationId: string) {
  return prisma.refund.findUnique({
    where: { originatorConversationId },
    include: { merchant: true },
  });
}

export async function applyRefundResult(
  id: string,
  data: { status: string; resultCode: number | null; resultDesc: string | null; mpesaReceipt: string | null }
) {
  return prisma.refund.update({
    where: { id },
    data: {
      status: data.status,
      resultCode: data.resultCode,
      resultDesc: data.resultDesc,
      ...(data.mpesaReceipt ? { mpesaReceipt: data.mpesaReceipt } : {}),
    },
  });
}
