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
import { RefreshCw, ShoppingCart } from "lucide-react";
import { SummaryData } from "./summary-cards";

export interface Transaction {
  id: string;
  amount: number;
  phone: string;
  status: string;
  orderReference: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface TransactionsTableProps {
  initialTransactions: Transaction[];
  onSummaryUpdate?: (summary: SummaryData) => void;
}

export function TransactionsTable({ initialTransactions, onSummaryUpdate }: TransactionsTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const previousSummaryRef = React.useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      try {
        setIsRefreshing(true);
        const res = await fetch("/api/merchant/transactions?limit=50", {
          signal: controller.signal
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setTransactions(json.data.transactions);
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
  }, [onSummaryUpdate]);

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/merchant/transactions?limit=50");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setTransactions(json.data.transactions);
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
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No transactions yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              When customers make payments, they will appear here in real-time.
            </p>
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
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.id.split('_').pop()?.substring(0, 8) || t.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{maskPhone(t.phone)}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
