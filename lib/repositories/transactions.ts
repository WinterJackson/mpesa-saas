import { prisma } from '@/lib/db';
import crypto from 'node:crypto';
import { clampLimit, cursorWhere, toPage, DEFAULT_PAGE_SIZE, type Page } from '@/lib/pagination';

export interface TransactionRow {
  id: string;
  amount: number;
  phone: string;
  status: string;
  orderReference: string | null;
  environment: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionDetail extends TransactionRow {
  merchantId: string;
  checkoutRequestId: string | null;
  mpesaReceipt: string | null;
  resultCode: number | null;
  resultDesc: string | null;
}

export interface TransactionStatusSummary {
  status: string;
  _count: { id: number };
  _sum: { amount: number | null };
}

const LIST_SELECT = {
  id: true,
  amount: true,
  phone: true,
  status: true,
  orderReference: true,
  environment: true,
  source: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Records a completed C2B transaction (customer paid the Paybill/Till directly).
 * Idempotent on the M-Pesa receipt (TransID) — Safaricom may re-send a
 * confirmation. Returns null if a transaction with that receipt already exists.
 */
export async function createC2BTransactionIfNew(params: {
  organizationId: string;
  merchantId: string;
  environment: string;
  amount: number;
  phone: string;
  mpesaReceipt: string;
  orderReference: string | null;
}) {
  const existing = await prisma.transaction.findFirst({
    where: { organizationId: params.organizationId, mpesaReceipt: params.mpesaReceipt },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.transaction.create({
    data: {
      organizationId: params.organizationId,
      merchantId: params.merchantId,
      environment: params.environment,
      amount: params.amount,
      phone: params.phone,
      mpesaReceipt: params.mpesaReceipt,
      orderReference: params.orderReference,
      status: 'completed',
      resultCode: 0,
      resultDesc: 'C2B payment received',
      source: 'c2b',
    },
    include: { merchant: true },
  });
}

export async function findTransactionById(
  organizationId: string,
  id: string
): Promise<TransactionDetail | null> {
  return prisma.transaction.findFirst({
    where: { id, organizationId },
    select: {
      ...LIST_SELECT,
      merchantId: true,
      checkoutRequestId: true,
      mpesaReceipt: true,
      resultCode: true,
      resultDesc: true,
    },
  });
}

export async function listTransactions(
  organizationId: string,
  opts: { take?: number; environment?: string } = {}
): Promise<TransactionRow[]> {
  return prisma.transaction.findMany({
    where: {
      organizationId,
      ...(opts.environment ? { environment: opts.environment } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 50,
    select: LIST_SELECT,
  });
}

export interface TransactionListItem extends TransactionRow {
  mpesaReceipt: string | null;
}

/**
 * Cursor-paginated, org-scoped transaction list ordered (createdAt desc, id desc).
 * Optional environment/status filters power both the dashboard "load more" table
 * and the public GET /api/v1/transactions endpoint.
 */
export async function listTransactionsPage(
  organizationId: string,
  opts: { cursor?: string | null; limit?: number; environment?: string; status?: string } = {}
): Promise<Page<TransactionListItem>> {
  const limit = clampLimit(opts.limit ?? DEFAULT_PAGE_SIZE);
  const rows = await prisma.transaction.findMany({
    where: {
      organizationId,
      ...(opts.environment ? { environment: opts.environment } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...cursorWhere(opts.cursor),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: { ...LIST_SELECT, mpesaReceipt: true },
  });
  return toPage(rows, limit);
}

export async function transactionStatusSummary(
  organizationId: string,
  opts: { environment?: string } = {}
) {
  const stats = await prisma.transaction.groupBy({
    by: ['status'],
    where: {
      organizationId,
      ...(opts.environment ? { environment: opts.environment } : {}),
    },
    _count: { id: true },
    _sum: { amount: true },
  });
  return stats as TransactionStatusSummary[];
}

export async function transactionUsageForPeriod(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ txCount: number; txVolume: number }> {
  const result = await prisma.transaction.aggregate({
    where: {
      organizationId,
      status: 'completed',
      createdAt: { gte: periodStart, lt: periodEnd },
    },
    _count: { id: true },
    _sum: { amount: true },
  });

  return { txCount: result._count.id, txVolume: result._sum.amount ?? 0 };
}

/**
 * Seeds a small set of sample transactions so a new merchant can see a populated
 * dashboard. Org-scoped (guardrail #6) and idempotent-ish: refuses when the
 * merchant already has ≥5 transactions. `source: 'demo'` marks them so they are
 * distinguishable from real activity.
 */
export async function seedDemoTransactions(params: {
  organizationId: string;
  merchantId: string;
  environment: string;
}): Promise<{ seeded: number } | { alreadySeeded: true }> {
  const { organizationId, merchantId, environment } = params;

  const existingCount = await prisma.transaction.count({ where: { organizationId, merchantId } });
  if (existingCount >= 5) return { alreadySeeded: true };

  const rid = () => crypto.randomBytes(4).toString('hex');
  const base = { merchantId, organizationId, environment, source: 'demo' as const };
  const rows = [
    { ...base, amount: 1500, phone: '254712345678', orderReference: 'ORD-77A9B1', status: 'completed', checkoutRequestId: `ws_CO_demo_${merchantId}_${rid()}_1`, mpesaReceipt: 'QEG12A3B4C', resultCode: 0, resultDesc: 'The service request is processed successfully.' },
    { ...base, amount: 250, phone: '254798765432', orderReference: 'ORD-88B9C2', status: 'pending', checkoutRequestId: `ws_CO_demo_${merchantId}_${rid()}_2`, mpesaReceipt: null, resultCode: null, resultDesc: null },
    { ...base, amount: 8000, phone: '254700112233', orderReference: 'ORD-99C9D3', status: 'cancelled', checkoutRequestId: `ws_CO_demo_${merchantId}_${rid()}_3`, mpesaReceipt: null, resultCode: 1032, resultDesc: 'Request cancelled by user' },
    { ...base, amount: 3200, phone: '254744556677', orderReference: 'ORD-11D9E4', status: 'completed', checkoutRequestId: `ws_CO_demo_${merchantId}_${rid()}_4`, mpesaReceipt: 'QEG98Z7Y6X', resultCode: 0, resultDesc: 'The service request is processed successfully.' },
    { ...base, amount: 500, phone: '254799887766', orderReference: 'ORD-22E9F5', status: 'failed', checkoutRequestId: `ws_CO_demo_${merchantId}_${rid()}_5`, mpesaReceipt: null, resultCode: 1, resultDesc: 'Insufficient funds' },
  ];

  await prisma.transaction.createMany({ data: rows });
  return { seeded: rows.length };
}

export function summarizeStats(stats: TransactionStatusSummary[]) {
  let totalTransactions = 0;
  let totalRevenue = 0;
  let completedCount = 0;
  let pendingCount = 0;

  for (const stat of stats) {
    const count = stat._count.id;
    totalTransactions += count;
    if (stat.status === 'completed') {
      completedCount += count;
      totalRevenue += stat._sum.amount || 0;
    }
    if (stat.status === 'pending') {
      pendingCount += count;
    }
  }

  const successRate = totalTransactions > 0 ? Math.round((completedCount / totalTransactions) * 100) : 0;

  return { totalTransactions, totalRevenue, successRate, pendingCount };
}
