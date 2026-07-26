"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface LinkFormValues {
  title: string;
  description: string;
  amountType: "fixed" | "customer_set";
  amount: string;
  expiresAt: string;
  redirectUrl: string;
  successMessage: string;
  collectContact: boolean;
}

const EMPTY: LinkFormValues = {
  title: "",
  description: "",
  amountType: "fixed",
  amount: "",
  expiresAt: "",
  redirectUrl: "",
  successMessage: "",
  collectContact: false,
};

export function PaymentLinkFormDialog({
  open,
  onOpenChange,
  mode,
  linkId,
  initial,
  businessName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  linkId?: string;
  initial?: Partial<LinkFormValues>;
  businessName: string;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<LinkFormValues>(EMPTY);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Seed the form from `initial` each time the dialog opens (create → blank,
    // edit → the link's values). Intentional sync from props on open.
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setValues({ ...EMPTY, ...initial });
      setShowAdvanced(Boolean(initial?.redirectUrl || initial?.successMessage || initial?.collectContact));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, initial]);

  function set<K extends keyof LinkFormValues>(key: K, val: LinkFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      toast.error("Give your link a title.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        amountType: values.amountType,
        amount: values.amountType === "fixed" ? Number(values.amount) : undefined,
        expiresAt: values.expiresAt || undefined,
        redirectUrl: values.redirectUrl.trim() || "",
        successMessage: values.successMessage.trim() || "",
        collectContact: values.collectContact,
      };
      const res = await fetch(
        mode === "create" ? "/api/merchant/payment-links" : `/api/merchant/payment-links/${linkId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(mode === "create" ? "Payment link created." : "Payment link updated.");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(json.error || "Could not save the link.");
      }
    } catch {
      toast.error("Could not save the link.");
    } finally {
      setSaving(false);
    }
  }

  const previewAmount =
    values.amountType === "fixed"
      ? values.amount
        ? `KES ${Number(values.amount).toLocaleString("en-KE")}`
        : "KES —"
      : "You choose the amount";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New payment link" : "Edit payment link"}</DialogTitle>
          <DialogDescription>
            Share the link or its QR code — customers pay with M-Pesa on a secure PaySwift page. No code needed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="pl-title">Title</Label>
              <Input id="pl-title" placeholder="e.g. Blue T-Shirt, or Invoice #1024" value={values.title} onChange={(e) => set("title", e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label>Amount</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={values.amountType === "fixed" ? "default" : "outline"} onClick={() => set("amountType", "fixed")}>
                  Fixed price
                </Button>
                <Button type="button" size="sm" variant={values.amountType === "customer_set" ? "default" : "outline"} onClick={() => set("amountType", "customer_set")}>
                  Customer enters amount
                </Button>
              </div>
            </div>

            {values.amountType === "fixed" && (
              <div className="space-y-1">
                <Label htmlFor="pl-amount">Amount (KES)</Label>
                <Input id="pl-amount" type="number" inputMode="numeric" min={1} placeholder="2500" value={values.amount} onChange={(e) => set("amount", e.target.value)} required />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="pl-desc">Description (optional)</Label>
              <Input id="pl-desc" placeholder="Shown to the customer at checkout" value={values.description} onChange={(e) => set("description", e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pl-expiry">Expires (optional)</Label>
              <Input id="pl-expiry" type="datetime-local" value={values.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
            </div>

            {/* Advanced */}
            <div>
              <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Advanced options
                <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} />
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-4 rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <Label htmlFor="pl-redirect">Redirect after payment (optional)</Label>
                    <Input id="pl-redirect" placeholder="https://your-store.com/thank-you" value={values.redirectUrl} onChange={(e) => set("redirectUrl", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Send the customer here after a successful payment (must be https).</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pl-success">Custom thank-you message (optional)</Label>
                    <Input id="pl-success" placeholder="Thanks! We'll ship your order today." value={values.successMessage} onChange={(e) => set("successMessage", e.target.value)} maxLength={300} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={values.collectContact} onChange={(e) => set("collectContact", e.target.checked)} className="size-4 rounded border-border" />
                    Ask the customer for their name &amp; email at checkout
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Create link" : "Save changes"}
              </Button>
            </div>
          </form>

          {/* Live preview */}
          <div className="hidden md:block">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mx-auto max-w-[13rem] rounded-xl border border-border bg-background p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Smartphone className="size-4 text-primary" />
                  <span className="truncate text-xs font-medium text-muted-foreground">{businessName}</span>
                </div>
                <p className="text-sm font-semibold text-foreground break-words">{values.title || "Your item"}</p>
                {values.description && <p className="mt-1 text-xs text-muted-foreground break-words">{values.description}</p>}
                <p className="mt-3 text-lg font-bold tracking-tight text-foreground">{previewAmount}</p>
                <div className="mt-3 rounded-lg bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground">
                  Pay with M-Pesa
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
