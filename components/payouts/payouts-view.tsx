'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { sendPayoutAction, refundTransactionAction } from '@/lib/actions/payouts';
import { toast } from 'sonner';

function kes(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
  return <Badge variant={variant} className="capitalize">{status}</Badge>;
}

export interface PayoutRow {
  id: string;
  amount: number;
  phone: string;
  status: string;
  remarks: string | null;
  mpesaReceipt: string | null;
  createdAt: string;
}

export interface RefundRow {
  id: string;
  amount: number;
  phone: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

export interface RefundableTx {
  id: string;
  amount: number;
  phone: string;
  orderReference: string | null;
  mpesaReceipt: string | null;
  createdAt: string;
}

export function PayoutsView({
  payouts,
  refunds,
  refundable,
  environment,
}: {
  payouts: PayoutRow[];
  refunds: RefundRow[];
  refundable: RefundableTx[];
  environment: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [sending, setSending] = useState(false);
  const [busyTxId, setBusyTxId] = useState<string | null>(null);

  async function doSendPayout() {
    setSending(true);
    try {
      const res = await sendPayoutAction({ phone, amount, remarks });
      if (res.success) {
        toast.success(res.message);
        setPhone('');
        setAmount('');
        setRemarks('');
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleRefund(transactionId: string) {
    setBusyTxId(transactionId);
    try {
      const res = await refundTransactionAction({ transactionId });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } finally {
      setBusyTxId(null);
    }
  }

  return (
    <Tabs defaultValue="payouts" className="w-full">
      <TabsList>
        <TabsTrigger value="payouts">Payouts</TabsTrigger>
        <TabsTrigger value="refunds">Refunds</TabsTrigger>
      </TabsList>

      {/* ── Payouts ── */}
      <TabsContent value="payouts" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send a payout</CardTitle>
            <CardDescription>
              Send money from your M-Pesa account to any phone number.
              {environment === 'sandbox' && ' You are in sandbox mode — this uses test money.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="payout-phone">Phone number</Label>
                <Input id="payout-phone" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-44" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="payout-amount">Amount (KES)</Label>
                <Input id="payout-amount" type="number" min={1} placeholder="1000" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32" />
              </div>
              <div className="space-y-1 flex-1 min-w-40">
                <Label htmlFor="payout-remarks">Note (optional)</Label>
                <Input id="payout-remarks" placeholder="e.g. Supplier payment" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
              <ConfirmButton
                variant="default"
                size="default"
                disabled={sending || !phone.trim() || !amount.trim()}
                onConfirm={doSendPayout}
                title="Send this payout?"
                description={`${amount ? kes(Number(amount)) : 'This amount'} will be sent to ${phone || 'the phone number'} via M-Pesa. This cannot be undone once confirmed.`}
                confirmLabel="Send payout"
              >
                {sending ? 'Sending…' : 'Send payout'}
              </ConfirmButton>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout history</CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payouts yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{p.phone}</TableCell>
                      <TableCell className="text-right">{kes(p.amount)}</TableCell>
                      <TableCell className="max-w-40 truncate text-muted-foreground">{p.remarks ?? '—'}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Refunds ── */}
      <TabsContent value="refunds" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Refund a payment</CardTitle>
            <CardDescription>Send a completed payment back to the customer who made it.</CardDescription>
          </CardHeader>
          <CardContent>
            {refundable.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed payments available to refund.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refundable.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground">{tx.orderReference ?? tx.mpesaReceipt ?? '—'}</TableCell>
                      <TableCell>{tx.phone}</TableCell>
                      <TableCell className="text-right">{kes(tx.amount)}</TableCell>
                      <TableCell className="text-right">
                        <ConfirmButton
                          size="xs"
                          variant="outline"
                          disabled={busyTxId === tx.id}
                          onConfirm={() => handleRefund(tx.id)}
                          title="Refund this payment?"
                          description={`${kes(tx.amount)} will be sent back to ${tx.phone} via M-Pesa. This cannot be undone.`}
                          confirmLabel="Refund payment"
                        >
                          {busyTxId === tx.id ? 'Refunding…' : 'Refund'}
                        </ConfirmButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Refund history</CardTitle>
          </CardHeader>
          <CardContent>
            {refunds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No refunds yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{r.phone}</TableCell>
                      <TableCell className="text-right">{kes(r.amount)}</TableCell>
                      <TableCell className="max-w-40 truncate text-muted-foreground">{r.reason ?? '—'}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
