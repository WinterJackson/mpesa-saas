import { prisma } from '@/lib/db';
import { prismaReadonly } from '@/lib/db-readonly';

export type HealthComponent = 'database' | 'redis' | 'daraja_sandbox';
export type HealthStatus = 'operational' | 'degraded' | 'down';

export const HEALTH_COMPONENTS: HealthComponent[] = ['database', 'redis', 'daraja_sandbox'];

export const HEALTH_COMPONENT_LABELS: Record<HealthComponent, string> = {
  database: 'Database',
  redis: 'Rate limiting / caching (Redis)',
  daraja_sandbox: 'M-Pesa Daraja sandbox connectivity',
};

export interface HealthCheckResult {
  component: HealthComponent;
  status: HealthStatus;
  latencyMs: number | null;
}

export async function recordHealthCheck(result: HealthCheckResult) {
  return prisma.healthCheck.create({ data: result });
}

export interface ComponentStatus {
  component: HealthComponent;
  status: HealthStatus;
  latencyMs: number | null;
  checkedAt: Date;
}

/** Latest recorded status for every component that has ever been checked. */
export async function latestComponentStatuses(): Promise<ComponentStatus[]> {
  const results = await Promise.all(
    HEALTH_COMPONENTS.map((component) =>
      prismaReadonly.healthCheck.findFirst({
        where: { component },
        orderBy: { checkedAt: 'desc' },
      })
    )
  );
  return results.filter((r): r is NonNullable<typeof r> => r !== null) as ComponentStatus[];
}

export interface DayBucket {
  date: string; // YYYY-MM-DD
  status: HealthStatus; // worst status seen that day
}

const STATUS_SEVERITY: Record<HealthStatus, number> = { operational: 0, degraded: 1, down: 2 };

/** Rolling per-day history for a component — one bucket per day, worst status wins. */
export async function componentHistory(component: HealthComponent, days = 90): Promise<DayBucket[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prismaReadonly.healthCheck.findMany({
    where: { component, checkedAt: { gte: since } },
    orderBy: { checkedAt: 'asc' },
    select: { status: true, checkedAt: true },
  });

  const byDay = new Map<string, HealthStatus>();
  for (const row of rows) {
    const day = row.checkedAt.toISOString().slice(0, 10);
    const status = row.status as HealthStatus;
    const current = byDay.get(day);
    if (!current || STATUS_SEVERITY[status] > STATUS_SEVERITY[current]) {
      byDay.set(day, status);
    }
  }
  return Array.from(byDay.entries()).map(([date, status]) => ({ date, status }));
}
