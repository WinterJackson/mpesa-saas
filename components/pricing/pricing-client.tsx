"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRICING_TIERS,
  ANNUAL_DISCOUNT,
  estimateMonthlyCost,
  bestTierFor,
  type PricingTier,
} from "@/lib/pricing";

function kes(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}

/** Per-month price to display for a tier under the chosen billing cycle. */
function displayedMonthly(tier: PricingTier, annual: boolean): number | null {
  if (tier.monthlyFee === null) return null;
  if (tier.monthlyFee === 0) return 0;
  return annual ? Math.round(tier.monthlyFee * (1 - ANNUAL_DISCOUNT)) : tier.monthlyFee;
}

function ctaFor(tier: PricingTier): { label: string; href: string } {
  if (tier.name === "Enterprise") return { label: "Contact sales", href: "#enterprise" };
  if (tier.name === "Sandbox") return { label: "Start building free", href: "/sign-up" };
  return { label: "Start free, no code needed", href: "/sign-up" };
}

export function PricingClient() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="flex flex-col gap-16">
      <BillingToggle annual={annual} onChange={setAnnual} />
      <PlanGrid annual={annual} />
      <CostEstimator />
    </div>
  );
}

function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "text-sm font-medium transition-colors",
          !annual ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={annual}
        aria-label="Toggle annual billing"
        onClick={() => onChange(!annual)}
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-primary/30 transition-colors"
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-primary shadow transition-transform",
            annual ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "text-sm font-medium transition-colors",
            annual ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Annual
        </button>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          Save {Math.round(ANNUAL_DISCOUNT * 100)}%
        </span>
      </span>
    </div>
  );
}

function PlanGrid({ annual }: { annual: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
      {PRICING_TIERS.map((tier) => (
        <PlanCard key={tier.name} tier={tier} annual={annual} />
      ))}
    </div>
  );
}

function PlanCard({ tier, annual }: { tier: PricingTier; annual: boolean }) {
  const monthly = displayedMonthly(tier, annual);
  const cta = ctaFor(tier);
  const discounted = annual && tier.monthlyFee !== null && tier.monthlyFee > 0;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6",
        tier.highlighted
          ? "border-primary bg-primary/5 shadow-[0_10px_40px_-15px_rgba(19,42,19,0.35)]"
          : "border-border bg-background"
      )}
    >
      {tier.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Most popular
        </span>
      )}

      <h3 className="font-heading text-xl font-bold">{tier.name}</h3>
      <p className="mt-2 min-h-[2.5rem] text-sm text-muted-foreground">{tier.tagline}</p>

      <div className="mt-6">
        {monthly === null ? (
          <p className="text-3xl font-extrabold font-heading">Custom</p>
        ) : (
          <div className="flex items-end gap-1">
            <span className="text-3xl font-extrabold font-heading">
              {monthly === 0 ? "Free" : kes(monthly)}
            </span>
            {monthly > 0 && <span className="pb-1 text-sm text-muted-foreground">/mo</span>}
          </div>
        )}
        {discounted && (
          <p className="mt-1 text-xs text-muted-foreground">
            billed annually · {kes(tier.monthlyFee as number)}/mo monthly
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 text-sm">
        {tier.includedTransactions !== null ? (
          <p className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong>{tier.includedTransactions.toLocaleString("en-KE")}</strong> live payments included
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{tier.name === "Sandbox" ? "Unlimited test payments" : "Custom volume"}</span>
          </p>
        )}
        {tier.overageFeeKes !== null && tier.overageFeeKes > 0 && (
          <p className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              then <strong>{kes(tier.overageFeeKes)}</strong> per extra payment — never a % of the sale
            </span>
          </p>
        )}
        <p className="flex items-start gap-2 text-muted-foreground">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{tier.audience}</span>
        </p>
      </div>

      <div className="mt-auto pt-6">
        <Link href={cta.href}>
          <Button
            variant={tier.highlighted ? "default" : "outline"}
            className="w-full rounded-full"
          >
            {cta.label}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Interactive cost estimator ──────────────────────────────────────────────

const ESTIMATOR_MIN = 0;
const ESTIMATOR_MAX = 20000;

function CostEstimator() {
  const [tx, setTx] = useState(1500);
  const best = useMemo(() => bestTierFor(tx), [tx]);

  const rows = PRICING_TIERS.filter((t) => t.billable && t.name !== "Enterprise" && t.name !== "Sandbox");

  return (
    <div className="rounded-2xl border border-border bg-sidebar/40 p-6 md:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <h3 className="font-heading text-2xl font-bold">What will I actually pay?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Drag to your expected monthly M-Pesa payments. We&apos;ll show the flat cost on each plan and
          pick the cheapest — no percentage of your sales, ever.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <div className="flex items-baseline justify-between">
          <label htmlFor="tx-estimate" className="text-sm font-medium text-muted-foreground">
            Payments per month
          </label>
          <span className="font-heading text-2xl font-extrabold text-primary">
            {tx.toLocaleString("en-KE")}
            {tx >= ESTIMATOR_MAX && "+"}
          </span>
        </div>
        <input
          id="tx-estimate"
          type="range"
          min={ESTIMATOR_MIN}
          max={ESTIMATOR_MAX}
          step={100}
          value={tx}
          onChange={(e) => setTx(Number(e.target.value))}
          className="mt-3 w-full accent-primary"
        />
      </div>

      <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map((tier) => {
          const cost = estimateMonthlyCost(tier, tx) ?? 0;
          const isBest = tier.name === best.name;
          return (
            <div
              key={tier.name}
              className={cn(
                "rounded-xl border p-4 text-center transition-colors",
                isBest ? "border-primary bg-primary/10" : "border-border bg-background"
              )}
            >
              <p className="text-sm font-medium text-muted-foreground">{tier.name}</p>
              <p className="mt-1 font-heading text-xl font-bold">{kes(cost)}</p>
              <p className="mt-1 text-xs text-muted-foreground">/mo</p>
              {isBest && (
                <span className="mt-2 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  Best value
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
        Estimates use monthly (undiscounted) pricing. Annual billing saves a further{" "}
        {Math.round(ANNUAL_DISCOUNT * 100)}% on Growth and Scale.
      </p>
    </div>
  );
}
