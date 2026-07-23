"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, ShieldAlert } from "lucide-react";
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

interface EnvironmentCardProps {
  initialEnvironment: "sandbox" | "live";
}

export function EnvironmentCard({ initialEnvironment }: EnvironmentCardProps) {
  const [environment, setEnvironment] = useState<"sandbox" | "live">(initialEnvironment);
  const [isChanging, setIsChanging] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(true);

  const isLive = environment === "live";

  useEffect(() => {
    fetch("/api/merchant/settings/live-readiness")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLiveReady(data.data.liveReady);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingReadiness(false));
  }, []);

  const toggleEnvironment = async () => {
    setIsChanging(true);
    const targetEnv = isLive ? "sandbox" : "live";
    
    try {
      const res = await fetch("/api/merchant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: targetEnv }),
      });
      const json = await res.json();
      
      if (res.ok && json.success) {
        setEnvironment(targetEnv);
        toast.success(`Successfully switched to ${targetEnv.toUpperCase()} mode`);
        setDialogOpen(false);
      } else {
        toast.error(json.error || "Failed to update environment");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Server className="size-5" />
          Environment Mode
        </CardTitle>
        <CardDescription>
          Sandbox mode lets you test the full payment flow safely — no real money moves, and it uses Safaricom&apos;s official testing environment. To enable Live mode, complete Safaricom&apos;s Go-Live business verification, then add your own Daraja shortcode and credentials below under Payment Credentials — your live credentials are always your own, never shared with other organizations.
          <span className="mt-2 block text-xs">
            Note: this switch changes where your payments are actually routed. The Sandbox/Live toggle in
            the dashboard header is only a <strong>view filter</strong> — it changes which records you
            see, not how payments are processed.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-lg border border-border bg-muted/40">
          <div className="flex flex-col gap-1 text-center sm:text-left mb-4 sm:mb-0">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <div className={`size-2.5 rounded-full ${isLive ? "bg-destructive animate-pulse" : "bg-status-pending"}`} />
              <span className="font-semibold">{isLive ? "Live Mode" : "Sandbox Mode"}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {isLive 
                ? "Real transactions are being processed." 
                : "Using Safaricom Daraja mock API endpoints."}
            </span>
          </div>

          {isLive ? (
            <Button onClick={toggleEnvironment} disabled={isChanging} variant="outline">
              Switch to Sandbox
            </Button>
          ) : isLoadingReadiness ? (
            <Button disabled variant="outline">Loading...</Button>
          ) : !liveReady ? (
            <div title="Add your organization's live Daraja credentials under Payment Credentials below before switching to Live mode.">
              <Button disabled>Go Live</Button>
            </div>
          ) : (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button disabled={isChanging}>Go Live</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="size-5 text-destructive" />
                    Switch to Live Environment
                  </DialogTitle>
                  <DialogDescription className="pt-3">
                    Are you sure you want to go live? This means <strong>real money</strong> will be deducted from your customers&apos; M-Pesa accounts. 
                    Ensure you have completed all testing in the sandbox before proceeding.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isChanging}>
                    Cancel
                  </Button>
                  <Button onClick={toggleEnvironment} disabled={isChanging}>
                    {isChanging ? "Switching..." : "Yes, Go Live"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
