import { prisma } from '@/lib/db';

export async function createBalanceSnapshot(
  organizationId: string,
  data: { environment: string; balanceRaw: string; workingBalance: number | null }
) {
  return prisma.accountBalanceSnapshot.create({
    data: {
      organizationId,
      environment: data.environment,
      balanceRaw: data.balanceRaw,
      workingBalance: data.workingBalance,
    },
  });
}

export async function latestBalanceSnapshot(organizationId: string) {
  return prisma.accountBalanceSnapshot.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listBalanceSnapshots(organizationId: string, opts: { take?: number } = {}) {
  return prisma.accountBalanceSnapshot.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 20,
  });
}

/**
 * Best-effort parse of Daraja's AccountBalance string, e.g.
 * "Working Account|KES|481000.00|481000.00|0.00|0.00&Utility Account|KES|..."
 * → the Working Account's current balance in whole KES.
 */
export function parseWorkingBalance(balanceRaw: string): number | null {
  const accounts = balanceRaw.split('&');
  const working = accounts.find((a) => a.toLowerCase().startsWith('working account'));
  const target = working ?? accounts[0];
  if (!target) return null;
  const parts = target.split('|');
  // parts: [name, currency, currentBalance, availableBalance, ...]
  const value = Number(parts[2]);
  return Number.isFinite(value) ? Math.round(value) : null;
}
