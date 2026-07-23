'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { toast } from 'sonner';

export interface PaymentLinkItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  amountType: string;
  amount: number | null;
  active: boolean;
  environment: string;
  expiresAt: string | Date | null;
  createdAt: string | Date;
  paymentsCount: number;
  paymentsVolume: number;
}

const CAN_MANAGE_ROLES = ['owner', 'admin', 'developer'];

function publicUrl(slug: string): string {
  if (typeof window === 'undefined') return `/pay/${slug}`;
  return `${window.location.origin}/pay/${slug}`;
}

function isExpired(link: PaymentLinkItem): boolean {
  return link.expiresAt != null && new Date(link.expiresAt).getTime() <= Date.now();
}

export function PaymentLinksView({
  initialLinks,
  currentRole,
}: {
  initialLinks: PaymentLinkItem[];
  currentRole: string;
}) {
  const router = useRouter();
  const canManage = CAN_MANAGE_ROLES.includes(currentRole);

  const [links, setLinks] = useState<PaymentLinkItem[]>(initialLinks);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountType, setAmountType] = useState<'fixed' | 'customer_set'>('fixed');
  const [amount, setAmount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/merchant/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          amountType,
          amount: amountType === 'fixed' ? Number(amount) : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to create payment link');

      setLinks((prev) => [{ ...data.data, paymentsCount: 0, paymentsVolume: 0 }, ...prev]);
      toast.success('Payment link created.');
      setTitle('');
      setDescription('');
      setAmount('');
      setExpiresAt('');
      setAmountType('fixed');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy(slug: string) {
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      toast.success('Link copied to clipboard.');
    } catch {
      toast.error('Could not copy — copy it manually.');
    }
  }

  async function handleDeactivate(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/merchant/payment-links/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to deactivate');

      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, active: false } : l)));
      toast.success('Payment link deactivated.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create a payment link</CardTitle>
            <CardDescription>
              Share the link or its QR code with a customer — they pay with M-Pesa on a PaySwift-hosted
              page. No website or code needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="pl-title">Title</Label>
                <Input
                  id="pl-title"
                  placeholder="e.g. Blue T-Shirt, or Invoice #1024"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Amount</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={amountType === 'fixed' ? 'default' : 'outline'}
                    onClick={() => setAmountType('fixed')}
                  >
                    Fixed price
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={amountType === 'customer_set' ? 'default' : 'outline'}
                    onClick={() => setAmountType('customer_set')}
                  >
                    Customer enters amount
                  </Button>
                </div>
              </div>

              {amountType === 'fixed' && (
                <div className="space-y-1">
                  <Label htmlFor="pl-amount">Amount (KES)</Label>
                  <Input
                    id="pl-amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder="2500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="pl-description">Description (optional)</Label>
                <Input
                  id="pl-description"
                  placeholder="Shown to the customer at checkout"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pl-expiry">Expires (optional)</Label>
                <Input
                  id="pl-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create payment link'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {links.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Link2 className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No payment links yet.{canManage ? ' Create one above to get started.' : ''}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => {
                const expired = isExpired(link);
                return (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="font-medium">{link.title}</div>
                      <div className="font-mono text-xs text-muted-foreground break-all">/pay/{link.slug}</div>
                    </TableCell>
                    <TableCell>
                      {link.amountType === 'fixed' && link.amount != null
                        ? `KES ${link.amount.toLocaleString()}`
                        : 'Customer enters'}
                    </TableCell>
                    <TableCell>
                      {!link.active ? (
                        <Badge variant="outline">Inactive</Badge>
                      ) : expired ? (
                        <Badge variant="outline">Expired</Badge>
                      ) : (
                        <Badge>Active</Badge>
                      )}
                      {link.environment === 'live' && (
                        <Badge variant="outline" className="ml-1">Live</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.paymentsCount > 0 ? (
                        <span>
                          {link.paymentsCount}{' '}
                          <span className="text-muted-foreground">
                            (KES {link.paymentsVolume.toLocaleString()})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="xs" variant="outline" onClick={() => handleCopy(link.slug)}>
                          <Copy className="size-3.5" /> Copy
                        </Button>
                        <a href={publicUrl(link.slug)} target="_blank" rel="noopener noreferrer">
                          <Button type="button" size="xs" variant="outline">
                            <ExternalLink className="size-3.5" /> Open
                          </Button>
                        </a>
                        {canManage && link.active && (
                          <Button
                            type="button"
                            size="xs"
                            variant="destructive"
                            disabled={busyId === link.id}
                            onClick={() => handleDeactivate(link.id)}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
