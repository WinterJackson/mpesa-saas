"use client";

import { useState, useSyncExternalStore } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Link2, Copy, Eye, EyeOff, Plug } from "lucide-react";
import { toast } from "sonner";

interface ShopifyCardProps {
  initialDomain: string | null;
  initialToken: string | null;
  initialSecret: string | null;
}

const APP_URL_FALLBACK = process.env.NEXT_PUBLIC_APP_URL || "https://your-payswift-url.com";

// Reads window.location.origin without a hydration mismatch: the server
// snapshot stays the static fallback, the client snapshot reflects the real
// origin once mounted. No subscription needed since origin never changes
// after mount.
function subscribeToOrigin() {
  return () => {};
}
function getOriginSnapshot() {
  return window.location.origin;
}
function getServerOriginSnapshot() {
  return APP_URL_FALLBACK;
}

export function ShopifyCard({ initialDomain, initialToken, initialSecret }: ShopifyCardProps) {
  const [shopDomain, setShopDomain] = useState(initialDomain || "");
  const [accessToken, setAccessToken] = useState(initialToken || "");
  const [webhookSecret, setWebhookSecret] = useState(initialSecret || "");
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [isTokenRevealed, setIsTokenRevealed] = useState(false);
  const [isSecretRevealed, setIsSecretRevealed] = useState(false);

  const displayToken = isTokenRevealed ? accessToken : (accessToken ? "shpat_••••••••••••••••••••••••••" : "");
  const displaySecret = isSecretRevealed ? webhookSecret : (webhookSecret ? "••••••••••••••••••••••••••••••" : "");

  // Defer window.location.origin to after hydration to prevent mismatch
  const appUrl = useSyncExternalStore(subscribeToOrigin, getOriginSnapshot, getServerOriginSnapshot);
  const webhookUrl = `${appUrl}/api/integrations/shopify/webhook`;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/merchant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopifyShopDomain: shopDomain || null,
          shopifyAdminAccessToken: accessToken || null,
          shopifyWebhookSecret: webhookSecret || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Shopify integration settings saved");
      } else {
        toast.error(json.error || "Failed to save settings");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/merchant/settings/test-shopify-connection", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success && json.data.valid) {
        toast.success(`Connection successful: ${json.data.shopName || shopDomain}`);
      } else {
        toast.error("Connection failed. Check your domain and access token.");
      }
    } catch {
      toast.error("An unexpected error occurred while testing");
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${description} copied to clipboard`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-5" />
          Shopify Integration
        </CardTitle>
        <CardDescription className="space-y-4">
          <p>
            Connect your existing Shopify store so new orders automatically trigger an
            M-Pesa payment prompt to the customer — no manual work needed once it&apos;s set up.
          </p>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Quick setup:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                In Shopify Admin, go to <strong>Settings → Apps and sales channels → Develop apps</strong>. If an app already exists there from before 2026 with a visible API credentials tab, use it and skip to step 5 below — the old flow still works for that app.
              </li>
              <li>
                Otherwise you&apos;ll be sent to the <strong>Dev Dashboard</strong> to create a new app. Set Distribution to <strong>Custom</strong>, install target: this store. Grant scopes <code className="bg-muted px-1 py-0.5 rounded text-xs">read_orders</code> and <code className="bg-muted px-1 py-0.5 rounded text-xs">write_orders</code>.
              </li>
              <li>
                Copy the app&apos;s <strong>Client ID</strong> and <strong>Client Secret</strong>. Build this URL (replace <code className="bg-muted px-1 py-0.5 rounded text-xs">&#123;shop&#125;</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">&#123;client_id&#125;</code>, and use this integration&apos;s Webhook URL shown below as the <code className="bg-muted px-1 py-0.5 rounded text-xs">redirect_uri</code>, with a random string as <code className="bg-muted px-1 py-0.5 rounded text-xs">state</code>), and open it in a browser while logged in as the store admin:<br />
                <code className="bg-muted px-1 py-0.5 rounded text-xs break-all mt-1 mb-1 inline-block">https://&#123;shop&#125;.myshopify.com/admin/oauth/authorize?client_id=&#123;client_id&#125;&amp;scope=read_orders,write_orders&amp;redirect_uri=&#123;redirect_uri&#125;&amp;state=&#123;random_string&#125;</code><br />
                Approve the install. Shopify redirects to your <code className="bg-muted px-1 py-0.5 rounded text-xs">redirect_uri</code> with a <code className="bg-muted px-1 py-0.5 rounded text-xs">code</code> parameter in the URL — copy that code.
              </li>
              <li>
                Exchange the code for a permanent token:
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto mt-1 mb-1 whitespace-pre-wrap">
                  <code>{`curl -X POST https://{shop}.myshopify.com/admin/oauth/access_token \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -H 'Accept: application/json' \\
  -d 'client_id={client_id}' \\
  -d 'client_secret={client_secret}' \\
  -d 'code={code}'`}</code>
                </pre>
                The response&apos;s <code className="bg-muted px-1 py-0.5 rounded text-xs">access_token</code> field (starts with <code className="bg-muted px-1 py-0.5 rounded text-xs">shpat_</code>) is what goes in the Admin API Access Token field below. Do not add an <code className="bg-muted px-1 py-0.5 rounded text-xs">expiring</code> parameter to this request — omitting it is what makes the token permanent.
              </li>
              <li>
                Paste the shop domain, the <code className="bg-muted px-1 py-0.5 rounded text-xs">access_token</code> from step 4 as the Admin API Access Token, and the app&apos;s <strong>Client Secret</strong> from step 3 as the Webhook Signing Secret (it signs both this exchange and incoming webhooks — the Dev Dashboard has no separately-labeled &quot;webhook secret&quot;). Save, then click Test Connection.
              </li>
            </ol>
            <a 
              href="https://github.com/WinterJackson/mpesa-saas#-shopify-integration-guide" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 w-fit mt-3"
            >
              <Link2 className="size-4" /> Full step-by-step guide
            </a>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          
          <div className="space-y-2">
            <Label htmlFor="shopDomain">Shopify Store Domain</Label>
            <Input 
              id="shopDomain" 
              placeholder="e.g. your-store.myshopify.com" 
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="accessToken">Admin API Access Token</Label>
            <div className="flex gap-2">
              <Input
                id="accessToken"
                type="text"
                value={displayToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="shpat_..."
                className="font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsTokenRevealed(!isTokenRevealed)}
                title={isTokenRevealed ? "Hide token" : "Reveal token"}
              >
                {isTokenRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Signing Secret</Label>
            <div className="flex gap-2">
              <Input
                id="webhookSecret"
                type="text"
                value={displaySecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="From Shopify App API credentials..."
                className="font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSecretRevealed(!isSecretRevealed)}
                title={isSecretRevealed ? "Hide secret" : "Reveal secret"}
              >
                {isSecretRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Webhook URL to register in Shopify</Label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono border flex items-center overflow-x-auto text-muted-foreground">
                <Link2 className="size-4 mr-2 shrink-0" />
                <span className="truncate">{webhookUrl}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Register this URL in Shopify for the <span className="font-semibold">Order creation</span> event.
            </p>
          </div>

        </div>

        <div className="pt-4 border-t border-border flex items-center justify-between flex-wrap gap-4">
          <Button variant="secondary" onClick={handleTestConnection} disabled={isTesting || !shopDomain || !accessToken}>
            <Plug className="size-4 mr-2" />
            {isTesting ? "Testing..." : "Test Connection"}
          </Button>
          
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="size-4 mr-2" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
