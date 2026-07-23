"use client";

import React, { useEffect, useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { RefreshCw, ShoppingCart, ShoppingBag, Database } from "lucide-react";
import { SummaryData } from "./summary-cards";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Transaction {
  id: string;
  amount: number;
  phone: string;
  status: string;
  orderReference: string | null;
  environment: string;
  source: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface TransactionsTableProps {
  initialTransactions: Transaction[];
  initialNextCursor?: string | null;
  onSummaryUpdate?: (summary: SummaryData) => void;
  showFilters?: boolean;
  limit?: number;
  environment?: string;
}

export function TransactionsTable({ initialTransactions, initialNextCursor = null, onSummaryUpdate, showFilters = false, limit = 50, environment }: TransactionsTableProps) {
  const envQuery = environment ? `&environment=${environment}` : "";
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState("All");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const previousSummaryRef = React.useRef<string | null>(null);

  const filteredTransactions = filter === "All" 
    ? transactions 
    : transactions.filter(t => t.status.toLowerCase() === filter.toLowerCase());

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      try {
        setIsRefreshing(true);
        const res = await fetch(`/api/merchant/transactions?limit=${limit}${envQuery}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            // Don't clobber additional pages the user has loaded; the live
            // refresh only keeps the first page fresh.
            if (!hasLoadedMore) {
              setTransactions(json.data.transactions);
              setNextCursor(json.data.nextCursor ?? null);
            }
            if (onSummaryUpdate && json.data.summary) {
              const currentSummaryStr = JSON.stringify(json.data.summary);
              if (previousSummaryRef.current !== currentSummaryStr) {
                onSummaryUpdate(json.data.summary);
                previousSummaryRef.current = currentSummaryStr;
              }
            }
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error("Failed to poll transactions:", error);
        }
      } finally {
        setIsRefreshing(false);
        // Schedule next poll only after current request completes
        timeoutId = setTimeout(poll, 5000);
      }
    };

    // Initial poll schedule
    timeoutId = setTimeout(poll, 5000);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [onSummaryUpdate, limit, hasLoadedMore]);

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/merchant/transactions?limit=${limit}${envQuery}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setTransactions(json.data.transactions);
          setNextCursor(json.data.nextCursor ?? null);
          setHasLoadedMore(false);
          if (onSummaryUpdate && json.data.summary) {
            const currentSummaryStr = JSON.stringify(json.data.summary);
            if (previousSummaryRef.current !== currentSummaryStr) {
              onSummaryUpdate(json.data.summary);
              previousSummaryRef.current = currentSummaryStr;
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh transactions:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    try {
      setIsLoadingMore(true);
      const res = await fetch(`/api/merchant/transactions?limit=${limit}${envQuery}&cursor=${encodeURIComponent(nextCursor)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setTransactions((prev) => [...prev, ...json.data.transactions]);
          setNextCursor(json.data.nextCursor ?? null);
          setHasLoadedMore(true);
        }
      }
    } catch (error) {
      console.error("Failed to load more transactions:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const [isSeeding, setIsSeeding] = useState(false);
  
  const handleLoadSampleData = async () => {
    try {
      setIsSeeding(true);
      const res = await fetch("/api/merchant/seed-demo-data", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || "Sample data loaded");
        await handleManualRefresh();
      } else {
        toast.error(json.error || "Failed to load sample data");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSeeding(false);
    }
  };

  // Mask phone number: 254712345678 -> 2547***5678
  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 8) return phone;
    return `${phone.substring(0, 4)}***${phone.substring(phone.length - 4)}`;
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Live view of your latest payments. Refreshes every 5 seconds.
          </CardDescription>
        </div>
        <button 
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 rounded-md hover:bg-muted"
          aria-label="Refresh transactions"
        >
          <RefreshCw className={`size-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </CardHeader>
      
      {showFilters && (
        <div className="px-6 pb-4 flex flex-wrap gap-2 border-b border-border">
          {["All", "Completed", "Pending", "Failed", "Cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                filter === f 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <CardContent>
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No transactions yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              When customers make payments, they will appear here in real-time.
            </p>
            <Button onClick={handleLoadSampleData} disabled={isSeeding} variant="outline" className="mt-2">
              <Database className="size-4 mr-2" />
              {isSeeding ? "Loading..." : "Load Sample Data"}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Amount (KES)</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.id.split('_').pop()?.substring(0, 8) || t.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{maskPhone(t.phone)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <StatusBadge status={t.status} />
                        {t.environment === 'live' ? (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-destructive/10 text-destructive rounded-sm border border-destructive/20">Live</span>
                        ) : (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-muted text-muted-foreground rounded-sm border border-border">Sandbox</span>
                        )}
                        {t.source === 'shopify' && (
                          <span title="via Shopify" className="ml-2 flex items-center text-muted-foreground">
                            <ShoppingBag className="size-3.5" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {t.orderReference || '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(t.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {nextCursor && filter === "All" && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
