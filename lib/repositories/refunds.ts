import { withTenantContext, withPlatformContext } from '@/lib/db';

// Refund has Row-Level Security enabled (Phase 4, Stage 3) — every function
// below opens the appropriate tenant/platform context so the query is scoped
// at the database level too, not just via the `where` clause.

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
  return withTenantContext(organizationId, (tx) =>
    tx.refund.create({
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
    })
  );
}

export async function findRefundById(organizationId: string, id: string) {
  return withTenantContext(organizationId, (tx) => tx.refund.findFirst({ where: { id, organizationId } }));
}

export async function listRefunds(organizationId: string, opts: { take?: number } = {}) {
  return withTenantContext(organizationId, (tx) =>
    tx.refund.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 50,
    })
  );
}

export async function setRefundInitiation(
  organizationId: string,
  id: string,
  data: { conversationId: string; originatorConversationId: string }
) {
  return withTenantContext(organizationId, (tx) =>
    tx.refund.updateMany({
      where: { id, organizationId },
      data: { conversationId: data.conversationId, originatorConversationId: data.originatorConversationId },
    })
  );
}

export async function markRefundFailedOnInitiation(organizationId: string, id: string, resultDesc: string) {
  return withTenantContext(organizationId, (tx) =>
    tx.refund.updateMany({
      where: { id, organizationId },
      data: { status: 'failed', resultDesc },
    })
  );
}

// ─── Callback-correlation (NOT org-scoped; see payouts.ts note) ─────────────
// The B2C result callback identifies a refund by Safaricom's
// originatorConversationId before it knows which organization it belongs to
// — these two functions are the documented, intentional RLS bypass for that.

export async function findRefundByOriginatorId(originatorConversationId: string) {
  return withPlatformContext((tx) =>
    tx.refund.findUnique({
      where: { originatorConversationId },
      include: { merchant: true },
    })
  );
}

export async function applyRefundResult(
  id: string,
  data: { status: string; resultCode: number | null; resultDesc: string | null; mpesaReceipt: string | null }
) {
  return withPlatformContext((tx) =>
    tx.refund.update({
      where: { id },
      data: {
        status: data.status,
        resultCode: data.resultCode,
        resultDesc: data.resultDesc,
        ...(data.mpesaReceipt ? { mpesaReceipt: data.mpesaReceipt } : {}),
      },
    })
  );
}
