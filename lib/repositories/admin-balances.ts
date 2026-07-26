import { prismaReadonly } from '@/lib/db-readonly';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { resolveLowBalanceThreshold } from '@/lib/repositories/organizations';

export interface OrgBalanceRow {
  organizationId: string;
  businessName: string;
  workingBalance: number | null;
  checkedAt: Date | null;
  effectiveThresholdKes: number;
  belowThreshold: boolean;
}

/**
 * Cross-tenant admin view — audit-logged because it's a human admin reading
 * every organization's balance data (mirrors adminSearchTransactions).
 */
export async function getLatestBalancesAcrossOrganizations(
  adminUserId: string,
  opts: { take?: number } = {}
): Promise<OrgBalanceRow[]> {
  await writeAuditLog({ actorId: adminUserId, action: 'admin.balances_view' });

  const take = Math.min(opts.take ?? 100, 200);

  const orgs = await prismaReadonly.organization.findMany({
    where: { environment: 'live' },
    select: { id: true, businessName: true, lowBalanceThresholdKes: true },
    take,
  });

  const snapshots = await prismaReadonly.accountBalanceSnapshot.findMany({
    where: { environment: 'live', organizationId: { in: orgs.map((o) => o.id) } },
    orderBy: [{ organizationId: 'asc' }, { createdAt: 'desc' }],
    distinct: ['organizationId'],
  });

  const snapshotMap = new Map(snapshots.map((s) => [s.organizationId, s]));

  const rows: OrgBalanceRow[] = orgs.map((org) => {
    const snapshot = snapshotMap.get(org.id);
    const effectiveThresholdKes = resolveLowBalanceThreshold(org);
    const workingBalance = snapshot?.workingBalance ?? null;
    return {
      organizationId: org.id,
      businessName: org.businessName,
      workingBalance,
      checkedAt: snapshot?.createdAt ?? null,
      effectiveThresholdKes,
      belowThreshold: workingBalance != null && workingBalance < effectiveThresholdKes,
    };
  });

  // Lowest/most-at-risk first; orgs with no snapshot yet sort last (nothing to worry about yet).
  return rows.sort((a, b) => {
    if (a.workingBalance == null) return 1;
    if (b.workingBalance == null) return -1;
    return a.workingBalance - b.workingBalance;
  });
}
