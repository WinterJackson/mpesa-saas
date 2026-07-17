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
  initialKey: string;
}

export function ApiKeyCard({ initialKey }: ApiKeyCardProps) {
  const [apiKey, setApiKey] = useState(initialKey);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const displayKey = isRevealed ? apiKey : "••••••••••••••••••••••••••••••••";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setIsCopied(true);
      toast.success("API Key copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy API key");
    }
  };

  const regenerateKey = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/merchant/api-keys", {
        method: "POST",
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
    } catch (error) {
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
          Use this key to authenticate your backend requests to the PaySwift API.
          Keep it secure and never expose it in client-side code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Input 
              type={isRevealed ? "text" : "password"} 
              value={displayKey} 
              readOnly 
              className="font-mono pr-20"
            />
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
          </div>
          <Button 
            variant="outline" 
            onClick={copyToClipboard}
            className="shrink-0"
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
