import { prisma } from '@/lib/db';
import { prismaReadonly } from '@/lib/db-readonly';

// Platform-level reconciliation queries — deliberately NOT org-scoped (the
// nightly ledger job scans every organization), same posture as lib/repositories/admin.ts.

export type ReconResourceType = 'transaction' | 'payout' | 'daraja_command';

export interface StaleRecord {
  organizationId: string | null;
  resourceType: ReconResourceType;
  resourceId: string;
  reason: string;
}

/**
 * Finds records that a Daraja callback should have resolved but didn't: still
 * 'pending' past `olderThanMs`. We only SURFACE these — never mutate their
 * status (guardrail #4). Returns them as candidate mismatches.
 */
export async function findStalePendingRecords(olderThanMs: number): Promise<StaleRecord[]> {
  const cutoff = new Date(Date.now() - olderThanMs);

  const [transactions, payouts, commands] = await Promise.all([
    prisma.transaction.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      select: { id: true, organizationId: true, createdAt: true },
    }),
    prisma.payout.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      select: { id: true, organizationId: true, createdAt: true },
    }),
    prisma.darajaCommand.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      select: { id: true, organizationId: true, type: true, createdAt: true },
    }),
  ]);

  return [
    ...transactions.map((t) => ({
      organizationId: t.organizationId,
      resourceType: 'transaction' as const,
      resourceId: t.id,
      reason: `Transaction stuck 'pending' since ${t.createdAt.toISOString()} — no callback resolved it.`,
    })),
    ...payouts.map((p) => ({
      organizationId: p.organizationId,
      resourceType: 'payout' as const,
      resourceId: p.id,
      reason: `Payout stuck 'pending' since ${p.createdAt.toISOString()} — no B2C result callback arrived.`,
    })),
    ...commands.map((c) => ({
      organizationId: c.organizationId,
      resourceType: 'daraja_command' as const,
      resourceId: c.id,
      reason: `${c.type} command stuck 'pending' since ${c.createdAt.toISOString()} — no result callback arrived.`,
    })),
  ];
}

/** Idempotent — one open mismatch per (resourceType, resourceId). */
export async function upsertMismatch(record: StaleRecord) {
  return prisma.reconciliationMismatch.upsert({
    where: { resourceType_resourceId: { resourceType: record.resourceType, resourceId: record.resourceId } },
    update: { reason: record.reason },
    create: {
      organizationId: record.organizationId,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      reason: record.reason,
    },
  });
}

export async function listOpenMismatches(take = 100) {
  // Read-heavy admin listing — see lib/db-readonly.ts.
  return prismaReadonly.reconciliationMismatch.findMany({
    where: { status: 'open' },
    orderBy: { detectedAt: 'desc' },
    take,
  });
}

export async function resolveMismatch(id: string, status: 'resolved' | 'ignored') {
  return prisma.reconciliationMismatch.update({
    where: { id },
    data: { status, resolvedAt: new Date() },
  });
}
