"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Save, Send } from "lucide-react";
import { toast } from "sonner";

interface WebhookCardProps {
  initialUrl: string | null;
}

export function WebhookCard({ initialUrl }: WebhookCardProps) {
  const [webhookUrl, setWebhookUrl] = useState(initialUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

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
    } catch (error) {
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
    } catch (error) {
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
