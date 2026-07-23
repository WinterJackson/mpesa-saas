"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Wallet, CheckCircle2, Clock } from "lucide-react";

export interface SummaryData {
  totalTransactions: number;
  totalRevenue: number;
  successRate: number;
  pendingCount: number;
}

export function SummaryCards({ data }: { data: SummaryData }) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            KES {data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            From {data.totalTransactions} total transactions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalTransactions.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Lifetime volume
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-status-completed" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.successRate}%</div>
          <p className="text-xs text-muted-foreground">
            Of all initiated payments
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
          <Clock className="h-4 w-4 text-status-pending" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.pendingCount.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Awaiting customer PIN
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
