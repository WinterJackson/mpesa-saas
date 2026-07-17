"use client";

import { useState } from "react";
import { SummaryCards, SummaryData } from "./summary-cards";
import { TransactionsTable, Transaction } from "./transactions-table";

interface DashboardViewProps {
  initialSummary: SummaryData;
  initialTransactions: Transaction[];
}

export function DashboardView({ initialSummary, initialTransactions }: DashboardViewProps) {
  const [summary, setSummary] = useState<SummaryData>(initialSummary);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground mt-1">
          Monitor your M-Pesa collections in real-time.
        </p>
      </div>

      <SummaryCards data={summary} />
      
      <TransactionsTable 
        initialTransactions={initialTransactions} 
        onSummaryUpdate={setSummary} 
      />
    </div>
  );
}
