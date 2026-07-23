'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, Lock, Smartphone } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';

type PayState = 'idle' | 'initiating' | 'polling' | 'success' | 'failed';

export function PayCheckoutClient({
  slug,
  title,
  description,
  amountType,
  amount,
  businessName,
}: {
  slug: string;
  title: string;
  description: string | null;
  amountType: string;
  amount: number | null;
  businessName: string;
}) {
  const [phone, setPhone] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [state, setState] = useState<PayState>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const pollCountRef = useRef(0);

  const isFixed = amountType === 'fixed' && amount != null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('initiating');
    setError(null);
    pollCountRef.current = 0;

    try {
      const res = await fetch(`/api/pay/${slug}/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          amount: isFixed ? undefined : Number(customAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to start payment');

      setTransactionId(data.data.transactionId);
      setState('polling');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('failed');
    }
  }

  useEffect(() => {
    if (state !== 'polling' || !transactionId) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(`/api/pay/${slug}/status/${transactionId}`, { signal: controller.signal });
        const data = await res.json();
        pollCountRef.current += 1;

        if (res.ok && data.success) {
          const status = data.data.status;
          if (status === 'completed') {
            setReceipt(data.data.mpesaReceipt || 'CONFIRMED');
            setState('success');
            return;
          }
          if (status === 'failed' || status === 'cancelled') {
            setError(data.data.resultDesc || 'Payment failed or was cancelled.');
            setState('failed');
            return;
          }
        }

        // ~90s ceiling (45 × 2s) — matches Safaricom's STK prompt expiry + buffer.
        if (pollCountRef.current >= 45) {
          setError('Still waiting for confirmation. Check your phone, or try again shortly.');
          setState('failed');
          return;
        }

        timeoutId = setTimeout(poll, 2000);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        timeoutId = setTimeout(poll, 2000);
      }
    };

    poll();
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [state, transactionId, slug]);

  const displayAmount = isFixed ? amount! : Number(customAmount) || 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="sticky top-0 z-50 w-full pt-floating-header px-floating-header pb-4">
        <header className="w-full rounded-floating-header bg-background/80 backdrop-blur-md shadow-floating-header">
          <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
            <Logo />
            <ThemeToggle />
          </div>
        </header>
      </div>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardDescription>{businessName}</CardDescription>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>
            {state === 'idle' || state === 'initiating' ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-sm text-muted-foreground">Amount to pay</p>
                  <p className="text-3xl font-bold tracking-tight">
                    KES {displayAmount.toLocaleString()}
                  </p>
                </div>

                {!isFixed && (
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (KES)</Label>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="Enter amount"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      disabled={state === 'initiating'}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone">M-Pesa phone number</Label>
                  <Input
                    id="phone"
                    placeholder="0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={state === 'initiating'}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    You&apos;ll get a prompt on this number to approve the payment.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={state === 'initiating'}>
                  {state === 'initiating' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending prompt...
                    </>
                  ) : (
                    <>
                      <Smartphone className="mr-2 h-4 w-4" /> Pay with M-Pesa
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-border">
                  <Lock className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Secured by PaySwift</span>
                </div>
              </form>
            ) : state === 'polling' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="space-y-2">
                  <p className="font-semibold">Awaiting payment</p>
                  <p className="text-sm text-muted-foreground">
                    Check your phone and enter your M-Pesa PIN to complete the payment.
                  </p>
                </div>
              </div>
            ) : state === 'success' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <div className="h-16 w-16 bg-status-completed/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-status-completed" />
                </div>
                <p className="text-xl font-semibold">Payment successful</p>
                <p className="text-sm text-muted-foreground">
                  Your payment of KES {displayAmount.toLocaleString()} to {businessName} is confirmed.
                </p>
                <div className="bg-muted p-4 rounded-lg w-full flex justify-between items-center border border-border">
                  <span className="text-sm text-muted-foreground">Receipt No.</span>
                  <span className="font-mono font-bold">{receipt}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <div className="h-16 w-16 bg-status-failed/10 rounded-full flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-status-failed" />
                </div>
                <p className="text-xl font-semibold">Payment not completed</p>
                <p className="text-sm text-status-failed">{error}</p>
                <Button className="w-full" onClick={() => setState('idle')}>
                  Try again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
