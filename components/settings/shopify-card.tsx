"use client";

import { useState } from "react";
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

  // Using window.location.origin dynamically or falling back if SSR
  const appUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://your-payswift-url.com");
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
        <CardDescription>
          Connect a custom Shopify app to automatically trigger M-Pesa payments for new orders.
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
