"use client";

import { TransactionsTable, Transaction } from "./transactions-table";
import {
  AnalyticsSection,
  type AnalyticsBundle,
  type PlanUsage,
  type LinksSummary,
} from "./analytics-section";

interface DashboardViewProps {
  analytics: AnalyticsBundle;
  planUsage: PlanUsage;
  links: LinksSummary;
  initialTransactions: Transaction[];
}

export function DashboardView({ analytics, planUsage, links, initialTransactions }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground mt-1">
          How your M-Pesa collections are performing.
        </p>
      </div>

      <AnalyticsSection initial={analytics} planUsage={planUsage} links={links} />

      <div>
        <h3 className="text-lg font-semibold tracking-tight mb-3">Recent activity</h3>
        <TransactionsTable initialTransactions={initialTransactions} />
      </div>
    </div>
  );
}
