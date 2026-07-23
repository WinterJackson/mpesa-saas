'use client';

import { useState, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, RefreshCw, Send, Webhook } from 'lucide-react';
import { toast } from 'sonner';

export interface DeliveryRow {
  id: string;
  event: string | null;
  url: string;
  statusCode: number | null;
  success: boolean;
  status: string;
  attempt: number;
  createdAt: string;
  resourceType: string;
  resourceId: string | null;
  payload: unknown;
}

export function WebhookInspector({
  initialDeliveries,
  initialNextCursor,
  hasWebhookUrl,
  canManage,
}: {
  initialDeliveries: DeliveryRow[];
  initialNextCursor: string | null;
  hasWebhookUrl: boolean;
  canManage: boolean;
}) {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>(initialDeliveries);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/merchant/webhook-deliveries?limit=25');
    const json = await res.json();
    if (res.ok && json.success) {
      setDeliveries(json.data.deliveries);
      setNextCursor(json.data.nextCursor ?? null);
    }
  }

  async function handleSendTest() {
    setIsSendingTest(true);
    try {
      const res = await fetch('/api/merchant/settings/test-webhook', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to send test event');
      toast.success(json.data.delivered ? 'Test event delivered.' : `Test event sent (HTTP ${json.data.statusCode ?? 'error'}).`);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test event');
    } finally {
      setIsSendingTest(false);
    }
  }

  async function handleRedeliver(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/merchant/webhook-deliveries/${id}/redeliver`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Redelivery failed');
      toast.success(json.data.delivered ? 'Redelivered successfully.' : `Redelivery attempted (HTTP ${json.data.statusCode ?? 'error'}).`);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Redelivery failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/merchant/webhook-deliveries?limit=25&cursor=${encodeURIComponent(nextCursor)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setDeliveries((prev) => [...prev, ...json.data.deliveries]);
        setNextCursor(json.data.nextCursor ?? null);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
        {canManage && (
          <Button type="button" size="sm" onClick={handleSendTest} disabled={isSendingTest || !hasWebhookUrl}>
            <Send className="size-4" /> {isSendingTest ? 'Sending...' : 'Send test event'}
          </Button>
        )}
      </div>

      {!hasWebhookUrl && (
        <p className="text-sm text-muted-foreground">
          No webhook URL is configured yet. Add one in Settings to start receiving events.
        </p>
      )}

      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Webhook className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No webhook deliveries yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Event</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <Fragment key={d.id}>
                  <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                    <TableCell>
                      {expanded === d.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.event ?? '—'}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {d.resourceType}
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.status === 'delivered' ? 'default' : 'destructive'}>
                        {d.status === 'delivered' ? 'Delivered' : 'Failed'}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.statusCode ?? '—'}</TableCell>
                    <TableCell>{d.attempt}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(d.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {canManage && d.status === 'failed' && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={busyId === d.id || !hasWebhookUrl}
                          onClick={() => handleRedeliver(d.id)}
                        >
                          {busyId === d.id ? 'Redelivering...' : 'Redeliver'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expanded === d.id && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs">
                          <code>{JSON.stringify(d.payload, null, 2)}</code>
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
