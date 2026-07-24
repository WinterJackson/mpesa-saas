import {
  HEALTH_COMPONENTS,
  HEALTH_COMPONENT_LABELS,
  latestComponentStatuses,
  componentHistory,
  type HealthComponent,
  type HealthStatus,
} from '@/lib/repositories/health-checks';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<HealthStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

const STATUS_DOT_CLASS: Record<HealthStatus, string> = {
  operational: 'bg-status-completed',
  degraded: 'bg-status-pending',
  down: 'bg-status-failed',
};

const STATUS_BAR_CLASS: Record<HealthStatus, string> = {
  operational: 'bg-status-completed',
  degraded: 'bg-status-pending',
  down: 'bg-status-failed',
};

const HISTORY_DAYS = 90;

function overallStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('down')) return 'down';
  if (statuses.includes('degraded')) return 'degraded';
  return 'operational';
}

// Builds the last N calendar days (oldest first), giving every component's
// bar a consistent x-axis even for days with no recorded check yet. Defined
// outside the page component so the (deliberately current-time-dependent)
// Date.now() call isn't inside the component's own render body.
function buildDayRange(days: number): string[] {
  const now = Date.now();
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    result.push(new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return result;
}

export default async function StatusPage() {
  const [latest, histories] = await Promise.all([
    latestComponentStatuses(),
    Promise.all(HEALTH_COMPONENTS.map((component) => componentHistory(component, HISTORY_DAYS))),
  ]);

  const latestByComponent = new Map(latest.map((s) => [s.component, s]));
  const overall = overallStatus(latest.map((s) => s.status));
  const days = buildDayRange(HISTORY_DAYS);

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 mb-2">
        <span className={`h-3 w-3 rounded-full ${STATUS_DOT_CLASS[overall]}`} />
        <h1 className="text-3xl font-extrabold text-foreground">PaySwift Status</h1>
      </div>
      <p className="text-muted-foreground mb-2">
        {overall === 'operational'
          ? 'All systems operational.'
          : overall === 'degraded'
            ? 'Some systems are degraded.'
            : 'A system is currently down.'}
      </p>
      <p className="text-xs text-muted-foreground mb-10">
        This page reflects PaySwift&apos;s own infrastructure and does not report independently of it — if
        PaySwift itself is fully down, this page may not update.
      </p>

      <div className="space-y-8">
        {HEALTH_COMPONENTS.map((component: HealthComponent, i) => {
          const current = latestByComponent.get(component);
          const history = histories[i];
          const historyByDay = new Map(history.map((d) => [d.date, d.status]));

          return (
            <div key={component} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-foreground">{HEALTH_COMPONENT_LABELS[component]}</span>
                {current ? (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[current.status]}`} />
                    {STATUS_LABEL[current.status]}
                    {current.latencyMs != null && ` · ${current.latencyMs}ms`}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">No data yet</span>
                )}
              </div>

              <div className="flex gap-px" role="img" aria-label={`${HEALTH_COMPONENT_LABELS[component]} — ${HISTORY_DAYS}-day history`}>
                {days.map((date) => {
                  const status = historyByDay.get(date);
                  return (
                    <div
                      key={date}
                      title={`${date}: ${status ? STATUS_LABEL[status] : 'No data'}`}
                      className={`h-6 flex-1 rounded-[1px] ${status ? STATUS_BAR_CLASS[status] : 'bg-muted'}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{HISTORY_DAYS} days ago</span>
                <span>Today</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
