'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plug, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ERROR_MESSAGES: Record<string, string> = {
  shopify_not_configured: 'One-click connect is not available yet.',
  invalid_request: 'That Shopify request was invalid. Please try again.',
  hmac_failed: 'Could not verify the response from Shopify. Please try again.',
  state_mismatch: 'The connection session expired. Please try again.',
  not_signed_in: 'Your session expired during the connect. Please sign in and retry.',
  merchant_not_found: 'Your merchant account was not found.',
  forbidden: 'You do not have permission to connect Shopify.',
  token_exchange_failed: 'Shopify declined the connection. Please try again.',
  internal_error: 'Something went wrong connecting Shopify. Please try again.',
};

export function ShopifyConnectWizard({
  connected,
  shopDomain,
  oauthConfigured,
  canManage,
}: {
  connected: boolean;
  shopDomain: string | null;
  oauthConfigured: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [domain, setDomain] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Surface OAuth callback outcomes (redirected back with query params).
  useEffect(() => {
    const connectedShop = searchParams.get('connected');
    const error = searchParams.get('error');
    const warning = searchParams.get('warning');

    if (connectedShop) {
      toast.success(`Connected to ${connectedShop}.`);
      if (warning === 'webhook_registration_failed') {
        toast.warning('Connected, but automatic webhook setup failed — reconnect or contact support.');
      }
      router.replace('/integrations');
    } else if (error) {
      toast.error(ERROR_MESSAGES[error] ?? 'Could not connect Shopify.');
      router.replace('/integrations');
    }
  }, [searchParams, router]);

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const shop = domain.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
      toast.error('Enter your store domain like your-store.myshopify.com');
      return;
    }
    setIsConnecting(true);
    // Full-page navigation into the OAuth flow.
    window.location.href = `/api/integrations/shopify/oauth/start?shop=${encodeURIComponent(shop)}`;
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/shopify/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to disconnect');
      toast.success('Shopify store disconnected.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  }

  if (connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-status-completed" /> Shopify connected
          </CardTitle>
          <CardDescription>
            New orders in your store automatically send the customer an M-Pesa payment prompt, and paid
            orders are marked paid back in Shopify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge>Connected</Badge>
            <span className="font-mono text-sm">{shopDomain}</span>
          </div>
          {canManage && (
            <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect store'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-5" /> Connect your Shopify store
        </CardTitle>
        <CardDescription>
          Connect in one click — no code, no manual webhook setup. New orders will automatically prompt
          your customer to pay with M-Pesa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {oauthConfigured ? (
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop-domain">Your Shopify store domain</Label>
              <Input
                id="shop-domain"
                placeholder="your-store.myshopify.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={!canManage || isConnecting}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                You&apos;ll be taken to Shopify to approve the connection, then brought right back here.
              </p>
            </div>
            <Button type="submit" disabled={!canManage || isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Redirecting to Shopify...
                </>
              ) : (
                <>
                  <Plug className="mr-2 size-4" /> Connect Shopify
                </>
              )}
            </Button>
            {!canManage && (
              <p className="text-xs text-muted-foreground">
                Ask an owner or admin to connect the store.
              </p>
            )}
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            One-click Shopify connect isn&apos;t enabled on this platform yet. You can still connect
            manually using an Admin API access token in the advanced section below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
