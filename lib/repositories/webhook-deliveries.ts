import { prisma } from '@/lib/db';
import { clampLimit, cursorWhere, toPage, DEFAULT_PAGE_SIZE, type Page } from '@/lib/pagination';
import type { TransactionClient } from '@/lib/db';

export interface RecordDeliveryInput {
  organizationId: string;
  event: string;
  url: string;
  payload: unknown;
  statusCode: number | null;
  success: boolean;
  attempt: number;
  transactionId?: string | null;
  payoutId?: string | null;
  refundId?: string | null;
}

/**
 * Records a single webhook delivery attempt on the polymorphic WebhookDelivery
 * table — the ONE place all four emit sites (payment/payout/refund/test) write
 * through, so event/organizationId/status are always populated consistently.
 * `status` is dead-letter aware: a non-delivered attempt is 'failed'.
 */
export async function recordDelivery(input: RecordDeliveryInput, client: TransactionClient = prisma) {
  return client.webhookDelivery.create({
    data: {
      organizationId: input.organizationId,
      event: input.event,
      url: input.url,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: input.payload as any,
      statusCode: input.statusCode,
      success: input.success,
      status: input.success ? 'delivered' : 'failed',
      attempt: input.attempt,
      transactionId: input.transactionId ?? null,
      payoutId: input.payoutId ?? null,
      refundId: input.refundId ?? null,
    },
  });
}

export interface WebhookDeliveryRow {
  id: string;
  event: string | null;
  url: string;
  statusCode: number | null;
  success: boolean;
  status: string;
  attempt: number;
  createdAt: Date;
  resourceType: 'transaction' | 'payout' | 'refund' | 'other';
  resourceId: string | null;
  payload: unknown;
}

const LIST_SELECT = {
  id: true,
  event: true,
  url: true,
  statusCode: true,
  success: true,
  status: true,
  attempt: true,
  createdAt: true,
  transactionId: true,
  payoutId: true,
  refundId: true,
  payload: true,
} as const;

function toRow(d: {
  id: string;
  event: string | null;
  url: string;
  statusCode: number | null;
  success: boolean;
  status: string;
  attempt: number;
  createdAt: Date;
  transactionId: string | null;
  payoutId: string | null;
  refundId: string | null;
  payload: unknown;
}): WebhookDeliveryRow {
  const resourceType = d.transactionId
    ? 'transaction'
    : d.payoutId
      ? 'payout'
      : d.refundId
        ? 'refund'
        : 'other';
  return {
    id: d.id,
    event: d.event,
    url: d.url,
    statusCode: d.statusCode,
    success: d.success,
    status: d.status,
    attempt: d.attempt,
    createdAt: d.createdAt,
    resourceType,
    resourceId: d.transactionId ?? d.payoutId ?? d.refundId ?? null,
    payload: d.payload,
  };
}

/**
 * Org-scoped, cursor-paginated delivery list across ALL resource types
 * (transaction, payout AND refund — fixes the prior transaction-only bug).
 */
export async function listDeliveries(
  organizationId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<Page<WebhookDeliveryRow>> {
  const limit = clampLimit(opts.limit ?? DEFAULT_PAGE_SIZE);
  const rows = await prisma.webhookDelivery.findMany({
    where: { organizationId, ...cursorWhere(opts.cursor) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: LIST_SELECT,
  });
  const page = toPage(rows, limit);
  return { data: page.data.map(toRow), nextCursor: page.nextCursor };
}

/** Org-scoped single delivery (for the redeliver flow / payload inspection). */
export async function findDelivery(
  organizationId: string,
  id: string
): Promise<(WebhookDeliveryRow & { organizationId: string }) | null> {
  const d = await prisma.webhookDelivery.findFirst({
    where: { id, organizationId },
    select: { ...LIST_SELECT, organizationId: true },
  });
  if (!d) return null;
  return { ...toRow(d), organizationId: d.organizationId! };
}
