"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/charts/kpi-card";
import { PaymentLinkFormDialog, type LinkFormValues } from "./payment-link-form-dialog";
import { PaymentLinkDetailDrawer } from "./payment-link-detail-drawer";
import { Plus, Link2, Copy, Wallet, Activity, Gauge, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface PaymentLinkItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  amountType: string;
  amount: number | null;
  active: boolean;
  environment: string;
  expiresAt: string | Date | null;
  viewCount: number;
  createdAt: string | Date;
  paymentsCount: number;
  paymentsVolume: number;
}

const CAN_MANAGE_ROLES = ["owner", "admin", "developer"];
type StatusFilter = "all" | "active" | "inactive" | "expired";
type SortKey = "newest" | "revenue" | "payments";

function kes(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}
function publicUrl(slug: string): string {
  if (typeof window === "undefined") return `/pay/${slug}`;
  return `${window.location.origin}/pay/${slug}`;
}
function isExpired(l: PaymentLinkItem): boolean {
  return l.expiresAt != null && new Date(l.expiresAt).getTime() <= Date.now();
}

export function PaymentLinksView({
  initialLinks,
  currentRole,
  businessName,
}: {
  initialLinks: PaymentLinkItem[];
  currentRole: string;
  businessName: string;
}) {
  const router = useRouter();
  const canManage = CAN_MANAGE_ROLES.includes(currentRole);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editState, setEditState] = useState<{ id: string; values: Partial<LinkFormValues> } | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Overview KPIs (across all links) ──
  const kpis = useMemo(() => {
    const collected = initialLinks.reduce((s, l) => s + l.paymentsVolume, 0);
    const payments = initialLinks.reduce((s, l) => s + l.paymentsCount, 0);
    const views = initialLinks.reduce((s, l) => s + l.viewCount, 0);
    const active = initialLinks.filter((l) => l.active && !isExpired(l)).length;
    const conversion = views > 0 ? Math.round((payments / views) * 100) : null;
    return { collected, payments, views, active, conversion };
  }, [initialLinks]);

  // ── Filtered + sorted list ──
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = initialLinks.filter((l) => {
      if (q && !l.title.toLowerCase().includes(q) && !l.slug.toLowerCase().includes(q)) return false;
      if (status === "active") return l.active && !isExpired(l);
      if (status === "inactive") return !l.active;
      if (status === "expired") return l.active && isExpired(l);
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "revenue") return b.paymentsVolume - a.paymentsVolume;
      if (sort === "payments") return b.paymentsCount - a.paymentsCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return out;
  }, [initialLinks, query, status, sort]);

  function openCreate() {
    setFormMode("create");
    setEditState(null);
    setFormOpen(true);
  }
  function openEdit(id: string, values: Partial<LinkFormValues>) {
    setDetailOpen(false);
    setFormMode("edit");
    setEditState({ id, values });
    setFormOpen(true);
  }
  function openDetail(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }
  async function copyLink(slug: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy — copy it manually.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + create */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Links</h1>
          <p className="text-muted-foreground mt-1">Shareable M-Pesa payment pages — no code required.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New payment link
          </Button>
        )}
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Collected via links" value={kes(kpis.collected)} icon={Wallet} />
        <KpiCard label="Payments" value={kpis.payments.toLocaleString("en-KE")} icon={Activity} />
        <KpiCard label="Active links" value={kpis.active.toLocaleString("en-KE")} icon={Link2} />
        <KpiCard label="Conversion" value={kpis.conversion !== null ? `${kpis.conversion}%` : "—"} icon={Gauge} hint={`${kpis.views} views`} />
      </div>

      {/* Toolbar */}
      {initialLinks.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input placeholder="Search by title or link…" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {(["all", "active", "inactive", "expired"] as StatusFilter[]).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors", s === status ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {s}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground">
              <option value="newest">Newest</option>
              <option value="revenue">Most revenue</option>
              <option value="payments">Most payments</option>
            </select>
          </div>
        </div>
      )}

      {/* List */}
      {initialLinks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Link2 className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No payment links yet.</p>
            {canManage && (
              <Button onClick={openCreate}><Plus className="size-4" /> Create your first link</Button>
            )}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No links match your filters.</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="w-24 text-right">Share</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => {
                const expired = isExpired(l);
                const conv = l.viewCount > 0 ? Math.round((l.paymentsCount / l.viewCount) * 100) : null;
                return (
                  <TableRow key={l.id} onClick={() => openDetail(l.id)} className="cursor-pointer hover:bg-muted/50" title="View details">
                    <TableCell>
                      <div className="font-medium">{l.title}</div>
                      <div className="font-mono text-xs text-muted-foreground break-all">/pay/{l.slug}</div>
                    </TableCell>
                    <TableCell>{l.amountType === "fixed" && l.amount != null ? kes(l.amount) : "Customer enters"}</TableCell>
                    <TableCell>
                      {!l.active ? <Badge variant="outline">Inactive</Badge> : expired ? <Badge variant="outline">Expired</Badge> : <Badge>Active</Badge>}
                      {l.environment === "live" && <Badge variant="outline" className="ml-1">Live</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.paymentsCount > 0 ? (
                        <span>{l.paymentsCount} <span className="text-muted-foreground">· {kes(l.paymentsVolume)}</span></span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{conv !== null ? `${conv}%` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="xs" variant="outline" onClick={(e) => copyLink(l.slug, e)}><Copy className="size-3.5" /> Copy</Button>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground"><ChevronRight className="size-4" /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / edit dialog */}
      <PaymentLinkFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        linkId={editState?.id}
        initial={editState?.values}
        businessName={businessName}
        onSaved={() => router.refresh()}
      />

      {/* Detail drawer */}
      <PaymentLinkDetailDrawer
        linkId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        businessName={businessName}
        canManage={canManage}
        onChanged={() => router.refresh()}
        onEdit={openEdit}
      />
    </div>
  );
}
