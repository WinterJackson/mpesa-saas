"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { AlertTriangle, Receipt } from "lucide-react";
import { toast } from "sonner";
import { sourceLabel } from "@/lib/charts/palette";
import { refundTransactionAction } from "@/lib/actions/payouts";

interface TxDetail {
  id: string;
  amount: number;
  phone: string;
  status: string;
  environment: string;
  source: string;
  orderReference: string | null;
  mpesaReceipt: string | null;
  checkoutRequestId: string | null;
  internalNote: string | null;
  resultCode: number | null;
  resultDesc: string | null;
  createdAt: string;
  updatedAt: string;
  paymentLink: { title: string; slug: string } | null;
  failure: { reason: string; detail: string } | null;
}

function kes(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}
function dt(s: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(s));
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

export function TransactionDetailDrawer({
  transactionId,
  open,
  onOpenChange,
  canManage,
}: {
  transactionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const [tx, setTx] = useState<TxDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [isRefunding, startRefund] = useTransition();

  useEffect(() => {
    if (!open || !transactionId) return;
    let cancelled = false;
    // Reset to the loading state whenever the opened transaction changes. This is
    // the canonical "sync to an external store on prop change" effect; the setState
    // is intentional, not a cascading render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setTx(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/merchant/transactions/${transactionId}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setTx(json.data);
          setNote(json.data.internalNote ?? "");
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, transactionId]);

  async function saveNote() {
    if (!transactionId) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/merchant/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = await res.json();
      if (res.ok && json.success) toast.success("Note saved.");
      else toast.error(json.error || "Could not save note.");
    } catch {
      toast.error("Could not save note.");
    } finally {
      setSavingNote(false);
    }
  }

  function doRefund() {
    if (!transactionId) return;
    startRefund(async () => {
      const result = await refundTransactionAction({ transactionId });
      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {tx ? kes(tx.amount) : "Transaction"}
            {tx && <StatusBadge status={tx.status} />}
          </DialogTitle>
          <DialogDescription>Payment details, timeline and actions.</DialogDescription>
        </DialogHeader>

        {loading || !tx ? (
          <div className="space-y-3 py-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-20 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="space-y-5">
            {tx.failure && (
              <div className="flex items-start gap-2 rounded-lg border border-[#ec835a]/30 bg-[#ec835a]/10 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#ec835a]" />
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.failure.reason}</p>
                  <p className="text-xs text-muted-foreground">{tx.failure.detail}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Phone" value={tx.phone} />
              <Field label="M-Pesa receipt" value={tx.mpesaReceipt ?? "—"} mono />
              <Field label="Reference" value={tx.orderReference ?? "—"} />
              <Field label="Channel" value={sourceLabel(tx.source)} />
              <Field label="Environment" value={tx.environment === "live" ? "Live" : "Sandbox"} />
              <Field label="Started" value={dt(tx.createdAt)} />
              <Field label="Last updated" value={dt(tx.updatedAt)} />
              {tx.checkoutRequestId && <Field label="Checkout request" value={tx.checkoutRequestId} mono />}
            </div>

            {tx.paymentLink && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <Receipt className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Paid via link</span>
                <span className="font-medium text-foreground">{tx.paymentLink.title}</span>
              </div>
            )}

            {/* Internal note — merchant-only bookkeeping/support annotation */}
            <div className="space-y-2">
              <label htmlFor="tx-note" className="text-sm font-medium text-foreground">
                Internal note <span className="font-normal text-muted-foreground">(only your team sees this)</span>
              </label>
              <textarea
                id="tx-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!canManage || savingNote}
                rows={2}
                maxLength={1000}
                placeholder={canManage ? "e.g. Customer paid twice by mistake — second one refunded." : "No note."}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              {canManage && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={saveNote} disabled={savingNote}>
                    {savingNote ? "Saving…" : "Save note"}
                  </Button>
                </div>
              )}
            </div>

            {canManage && tx.status === "completed" && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Refund this payment</p>
                  <p className="text-xs text-muted-foreground">Send {kes(tx.amount)} back to {tx.phone} via M-Pesa.</p>
                </div>
                <ConfirmButton
                  size="sm"
                  variant="destructive"
                  disabled={isRefunding}
                  onConfirm={doRefund}
                  title="Refund this payment?"
                  description={`${kes(tx.amount)} will be sent back to ${tx.phone}. This can’t be undone.`}
                  confirmLabel="Refund"
                >
                  Refund
                </ConfirmButton>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
