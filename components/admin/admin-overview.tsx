"use client";

import { useEffect, useState } from "react";
import { DollarSign, UserMinus, Users, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/charts/kpi-card";
import { MiniFunnel } from "@/components/charts/mini-funnel";
import { ShareBar } from "@/components/charts/share-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import type { FunnelStage, MrrAndChurn } from "@/lib/repositories/admin-analytics";

export interface AdminAnalyticsBundle {
  funnel: FunnelStage[];
  mrrAndChurn: MrrAndChurn;
  byPlan: { name: string; monthlyFee: number; count: number; mrr: number }[];
  atRisk: {
    subscriptionId: string;
    organizationId: string;
    businessName: string;
    planName: string;
    status: string;
    gracePeriodEnd: string | null;
    outstandingInvoiceId: string | null;
    outstandingAmount: number | null;
  }[];
}

function kes(n: number): string {
  return `KES ${Math.round(n).toLocaleString("en-KE")}`;
}

export function AdminOverview() {
  const [bundle, setBundle] = useState<AdminAnalyticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/analytics");
        if (!res.ok) throw new Error("Failed to fetch admin analytics");
        const json = await res.json();
        
        // Parse date string from JSON for gracePeriodEnd
        if (json.atRisk) {
          for (const a of json.atRisk) {
            if (a.gracePeriodEnd) {
              a.gracePeriodEnd = new Date(a.gracePeriodEnd);
            }
          }
        }
        
        setBundle(json);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="animate-pulse h-32 bg-muted rounded-xl" />;
  }

  if (error || !bundle) {
    return <div className="text-sm text-destructive">Failed to load analytics overview.</div>;
  }

  const { funnel, mrrAndChurn, byPlan, atRisk } = bundle;
  
  // Calculate active subscriptions from byPlan
  const activeCount = byPlan.reduce((acc, p) => acc + p.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Platform-wide health for the <span className="font-medium text-foreground">last 30 days</span>
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard 
          label="Monthly recurring revenue" 
          value={kes(mrrAndChurn.mrr)} 
          icon={DollarSign} 
          changePct={mrrAndChurn.momChangePct} 
          hint="vs previous 30 days" 
        />
        <KpiCard 
          label="Churn rate" 
          value={`${mrrAndChurn.churnRatePct.toFixed(1)}%`} 
          icon={UserMinus} 
          deltaPositiveIsGood={false}
          hint={`over the last 30 days (${mrrAndChurn.churnMethod})`}
        />
        <KpiCard 
          label="Paying subscriptions" 
          value={activeCount.toLocaleString("en-KE")} 
          icon={Users} 
          hint="across all paid plans" 
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Signup to revenue funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniFunnel stages={funnel} />
          </CardContent>
        </Card>

        {/* Plan distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">MRR by plan tier</CardTitle>
          </CardHeader>
          <CardContent>
            {byPlan.length > 0 ? (
              <ShareBar
                items={byPlan.map((p) => ({ key: p.name, label: p.name, value: p.mrr }))}
                formatValue={kes}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No paying subscriptions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* At-risk Accounts */}
      {atRisk.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                At-risk accounts
              </CardTitle>
              <p className="text-sm text-muted-foreground">Failed collection — in grace or suspended.</p>
            </div>
            <Link href="/admin/billing">
              <Button variant="outline" size="sm">View all in Billing</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Grace ends</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRisk.slice(0, 5).map((a) => (
                  <TableRow key={a.subscriptionId}>
                    <TableCell className="font-medium">{a.businessName}</TableCell>
                    <TableCell>{a.planName}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "suspended" ? "destructive" : "secondary"}>
                        {a.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.gracePeriodEnd ? (a.gracePeriodEnd as unknown as Date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.outstandingAmount !== null ? kes(a.outstandingAmount) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
