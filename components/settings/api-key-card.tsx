"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Copy, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";
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

interface ApiKeyCardProps {
  initialKeyPrefix: string;
  initialScope: string;
  currentRole: string;
}

export function ApiKeyCard({ initialKeyPrefix, initialScope, currentRole }: ApiKeyCardProps) {
  const [apiKey, setApiKey] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCreateReadWrite = currentRole === "owner" || currentRole === "admin";
  const [selectedScope, setSelectedScope] = useState<"read_only" | "read_write">(
    canCreateReadWrite && initialScope === "read_write" ? "read_write" : canCreateReadWrite ? "read_write" : "read_only"
  );

  const displayKey = isRevealed && apiKey ? apiKey : (initialKeyPrefix ? `${initialKeyPrefix}••••••••••••••••••••` : "••••••••••••••••••••••••••••••••");

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setIsCopied(true);
      toast.success("API Key copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy API key");
    }
  };

  const regenerateKey = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/merchant/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: selectedScope }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setApiKey(json.data.key);
        setIsRevealed(true);
        toast.success("New API Key generated successfully");
        setDialogOpen(false);
      } else {
        toast.error(json.error || "Failed to generate new API key");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Key className="size-5" />
          API Key
        </CardTitle>
        <CardDescription>
          This key lets your own website&apos;s backend authenticate with PaySwift. Include
          it as the x-api-key header on every request to /api/v1/payments/initiate.
          Never use it in browser or mobile app code where customers could see it — it
          belongs only on your server.
          <br /><br />
          <strong>For security, we only ever show your full API key once, right when it&apos;s created. If you&apos;ve lost it, regenerate a new one.</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Input 
              type={isRevealed && apiKey ? "text" : "password"} 
              value={displayKey} 
              readOnly 
              className="font-mono pr-20"
            />
            {apiKey && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsRevealed(!isRevealed)}
                title={isRevealed ? "Hide API Key" : "Reveal API Key"}
              >
                {isRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            )}
          </div>
          <Button 
            variant="outline" 
            onClick={copyToClipboard}
            className="shrink-0"
            disabled={!apiKey}
          >
            {isCopied ? <CheckCircle2 className="size-4 mr-2" /> : <Copy className="size-4 mr-2" />}
            {isCopied ? "Copied" : "Copy"}
          </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button variant="destructive" className="mt-4">Regenerate API Key</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                Regenerate API Key
              </DialogTitle>
              <DialogDescription className="pt-3">
                Are you sure you want to regenerate your API key?
                <strong> This will immediately revoke your existing key.</strong> Any applications currently using the old key will fail to authenticate until updated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Key scope</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedScope === "read_write" ? "default" : "outline"}
                  disabled={!canCreateReadWrite}
                  onClick={() => setSelectedScope("read_write")}
                >
                  Read &amp; write
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedScope === "read_only" ? "default" : "outline"}
                  onClick={() => setSelectedScope("read_only")}
                >
                  Read-only
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {canCreateReadWrite
                  ? "Read-only keys can check payment status but cannot initiate payments."
                  : "Only owners and admins can create a read & write key — your role can only create read-only keys."}
              </p>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isGenerating}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={regenerateKey} disabled={isGenerating}>
                {isGenerating ? "Regenerating..." : "Yes, regenerate key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
