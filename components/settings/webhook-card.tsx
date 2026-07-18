"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Save, Send, Eye, EyeOff, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface WebhookCardProps {
  initialUrl: string | null;
  initialSecret: string | null;
}

export function WebhookCard({ initialUrl, initialSecret }: WebhookCardProps) {
  const [webhookUrl, setWebhookUrl] = useState(initialUrl || "");
  const [webhookSecret, setWebhookSecret] = useState(initialSecret || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const displaySecret = isRevealed ? webhookSecret : (webhookSecret ? "whsec_••••••••••••••••••••••••••••••••••••" : "Not generated");

  const copyToClipboard = async () => {
    if (!webhookSecret) return;
    try {
      await navigator.clipboard.writeText(webhookSecret);
      setIsCopied(true);
      toast.success("Signing Secret copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy signing secret");
    }
  };

  const regenerateSecret = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/merchant/webhook-secret/regenerate", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setWebhookSecret(json.data.secret);
        setIsRevealed(true);
        toast.success("New Signing Secret generated successfully");
        setDialogOpen(false);
      } else {
        toast.error(json.error || "Failed to generate new secret");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (webhookUrl) {
      try {
        const parsed = new URL(webhookUrl);
        if (parsed.protocol !== 'https:') {
          toast.error("Webhook URL must use HTTPS protocol");
          return;
        }
      } catch {
        toast.error("Please enter a valid URL");
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/merchant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: webhookUrl || null }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Webhook URL updated successfully");
      } else {
        toast.error(json.error || "Failed to update webhook URL");
      }
    } catch {
      toast.error("An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error("Please save a webhook URL first before testing");
      return;
    }

    setIsTesting(true);
    try {
      const res = await fetch("/api/merchant/settings/test-webhook", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Test payload delivered!</span>
            <span className="text-xs opacity-90">HTTP Status: {json.data.statusCode}</span>
          </div>
        );
      } else {
        toast.error(json.error || "Failed to deliver test payload");
      }
    } catch {
      toast.error("An error occurred while testing the webhook");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Link2 className="size-5" />
          Webhook Configuration
        </CardTitle>
        <CardDescription>
          Receive real-time HTTPS notifications when payment statuses change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Endpoint URL</Label>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              id="webhook-url"
              placeholder="https://api.yourdomain.com/webhooks/mpesa"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSave} disabled={isSaving} className="shrink-0">
              <Save className="size-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <Label>Signing Secret</Label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Input 
                type={isRevealed ? "text" : "password"} 
                value={displaySecret} 
                readOnly 
                className="font-mono pr-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsRevealed(!isRevealed)}
                title={isRevealed ? "Hide Secret" : "Reveal Secret"}
                disabled={!webhookSecret}
              >
                {isRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            <Button 
              variant="outline" 
              onClick={copyToClipboard}
              className="shrink-0"
              disabled={!webhookSecret}
            >
              {isCopied ? <CheckCircle2 className="size-4 mr-2" /> : <Copy className="size-4 mr-2" />}
              {isCopied ? "Copied" : "Copy"}
            </Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button variant="destructive" className="mt-4">Regenerate Secret</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-destructive" />
                  Regenerate Signing Secret
                </DialogTitle>
                <DialogDescription className="pt-3">
                  Are you sure you want to regenerate your webhook signing secret? 
                  <strong> This will immediately invalidate your existing secret.</strong> Any integrations verifying webhook signatures with the old secret will fail until updated.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isGenerating}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={regenerateSecret} disabled={isGenerating}>
                  {isGenerating ? "Regenerating..." : "Yes, regenerate secret"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="pt-4 border-t border-border mt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm text-muted-foreground">
              Send a test payload to verify your endpoint is receiving data correctly.
            </p>
            <Button 
              variant="secondary" 
              onClick={handleTest} 
              disabled={isTesting || !webhookUrl}
            >
              <Send className="size-4 mr-2" />
              {isTesting ? "Sending..." : "Test Webhook"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
