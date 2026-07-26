"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmbedSnippet } from "@/components/payment-links/embed-snippet";
import { Copy, MessageCircle, QrCode, Code2, ExternalLink, Pencil, CopyPlus, Printer } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import type { LinkFormValues } from "./payment-link-form-dialog";

interface RecentTx {
  id: string;
  amount: number;
  phone: string;
  status: string;
  createdAt: string;
}
interface LinkDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  amountType: string;
  amount: number | null;
  active: boolean;
  environment: string;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
  redirectUrl: string | null;
  successMessage: string | null;
  collectContact: boolean;
  paymentsCount: number;
  paymentsVolume: number;
  recentTransactions: RecentTx[];
}

function kes(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}
function publicUrl(slug: string): string {
  if (typeof window === "undefined") return `/pay/${slug}`;
  return `${window.location.origin}/pay/${slug}`;
}
function maskPhone(p: string): string {
  return p.length < 8 ? p : `${p.slice(0, 4)}***${p.slice(-4)}`;
}
function isExpired(expiresAt: string | null): boolean {
  return expiresAt != null && new Date(expiresAt).getTime() <= Date.now();
}

export function PaymentLinkDetailDrawer({
  linkId,
  open,
  onOpenChange,
  businessName,
  canManage,
  onChanged,
  onEdit,
}: {
  linkId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  canManage: boolean;
  onChanged: () => void;
  onEdit: (linkId: string, values: Partial<LinkFormValues>) => void;
}) {
  const [detail, setDetail] = useState<LinkDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!open || !linkId) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setDetail(null);
    setQr(null);
    setShowEmbed(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/merchant/payment-links/${linkId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setDetail(json.data);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, linkId]);

  const url = detail ? publicUrl(detail.slug) : "";
  const conversion =
    detail && detail.viewCount > 0 ? Math.round((detail.paymentsCount / detail.viewCount) * 100) : null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy — copy it manually.");
    }
  }

  function shareWhatsApp() {
    if (!detail) return;
    const msg = `Pay for "${detail.title}" with M-Pesa: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }

  async function showQr() {
    if (!detail) return;
    try {
      const data = await QRCode.toDataURL(url, { width: 320, margin: 2 });
      setQr(data);
    } catch {
      toast.error("Could not generate QR code.");
    }
  }

  async function printPoster() {
    if (!detail) return;
    const data = qr ?? (await QRCode.toDataURL(url, { width: 480, margin: 1 }).catch(() => null));
    if (!data) {
      toast.error("Could not prepare the poster.");
      return;
    }
    const amountLine =
      detail.amountType === "fixed" && detail.amount != null ? kes(detail.amount) : "Enter amount at checkout";
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${detail.title}</title>
      <style>
        *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
        body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;color:#0b0b0b}
        .poster{width:520px;text-align:center;padding:48px 40px;border:2px solid #132a13;border-radius:24px}
        .biz{font-size:20px;font-weight:600;color:#132a13}
        .title{font-size:28px;font-weight:700;margin:8px 0 4px}
        .amount{font-size:22px;font-weight:700;margin-bottom:24px}
        img{width:320px;height:320px}
        .cta{margin-top:24px;font-size:18px;font-weight:700;color:#132a13}
        .url{margin-top:12px;font-size:12px;color:#52514e;word-break:break-all}
      </style></head><body>
      <div class="poster">
        <div class="biz">${businessName}</div>
        <div class="title">${detail.title}</div>
        <div class="amount">${amountLine}</div>
        <img src="${data}" alt="QR code" />
        <div class="cta">Scan to Pay with M-Pesa</div>
        <div class="url">${url}</div>
      </div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    w.document.close();
  }

  function toFormValues(d: LinkDetail): Partial<LinkFormValues> {
    return {
      title: d.title,
      description: d.description ?? "",
      amountType: d.amountType as "fixed" | "customer_set",
      amount: d.amount != null ? String(d.amount) : "",
      expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().slice(0, 16) : "",
      redirectUrl: d.redirectUrl ?? "",
      successMessage: d.successMessage ?? "",
      collectContact: d.collectContact,
    };
  }

  function duplicate() {
    if (!linkId) return;
    startBusy(async () => {
      const res = await fetch(`/api/merchant/payment-links/${linkId}/duplicate`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Link duplicated.");
        onOpenChange(false);
        onChanged();
      } else toast.error(json.error || "Could not duplicate.");
    });
  }

  function deactivate() {
    if (!linkId) return;
    startBusy(async () => {
      const res = await fetch(`/api/merchant/payment-links/${linkId}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Link deactivated.");
        onOpenChange(false);
        onChanged();
      } else toast.error(json.error || "Could not deactivate.");
    });
  }

  const expired = detail ? isExpired(detail.expiresAt) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {detail?.title ?? "Payment link"}
            {detail && (
              <Badge variant={!detail.active ? "outline" : expired ? "outline" : "default"}>
                {!detail.active ? "Inactive" : expired ? "Expired" : "Active"}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Share, track performance and manage this link.</DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="space-y-3 py-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-16 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Public URL */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">/pay/{detail.slug}</span>
              <Button size="xs" variant="outline" onClick={copyLink}><Copy className="size-3.5" /> Copy</Button>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button size="xs" variant="outline"><ExternalLink className="size-3.5" /> Open</Button>
              </a>
            </div>

            {/* Share */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={shareWhatsApp}>
                <MessageCircle className="size-4 text-[#25D366]" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={showQr}><QrCode className="size-4" /> QR code</Button>
              <Button size="sm" variant="outline" onClick={printPoster}><Printer className="size-4" /> Print poster</Button>
              <Button size="sm" variant="outline" onClick={() => setShowEmbed((s) => !s)}><Code2 className="size-4" /> Embed</Button>
            </div>

            {qr && (
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Payment link QR code" width={200} height={200} className="rounded-lg border border-border" />
                <a href={qr} download={`payment-link-${detail.slug}.png`}>
                  <Button size="xs" variant="outline">Download PNG</Button>
                </a>
              </div>
            )}

            {showEmbed && (
              <EmbedSnippet
                payUrl={url}
                scriptUrl={typeof window !== "undefined" ? `${window.location.origin}/pay-button.js` : "/pay-button.js"}
              />
            )}

            {/* Analytics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Collected" value={kes(detail.paymentsVolume)} />
              <Stat label="Payments" value={String(detail.paymentsCount)} />
              <Stat label="Views" value={String(detail.viewCount)} />
              <Stat label="Conversion" value={conversion !== null ? `${conversion}%` : "—"} />
            </div>

            {/* Recent activity */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Recent payments</p>
              {detail.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments through this link yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {detail.recentTransactions.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{maskPhone(t.phone)}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{kes(t.amount)}</span>
                        <Badge variant={t.status === "completed" ? "default" : "outline"} className="capitalize">{t.status}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Actions */}
            {canManage && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button size="sm" variant="outline" onClick={() => onEdit(detail.id, toFormValues(detail))}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={duplicate} disabled={busy}>
                  <CopyPlus className="size-4" /> Duplicate
                </Button>
                {detail.active && (
                  <ConfirmButton
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onConfirm={deactivate}
                    title="Turn off this payment link?"
                    description={`"${detail.title}" will stop accepting payments and its link and QR code will no longer work.`}
                    confirmLabel="Turn off link"
                  >
                    Deactivate
                  </ConfirmButton>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
