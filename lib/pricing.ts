// Public-facing pricing catalog — a PURE module (no prisma, no server-only
// imports) so both the marketing /pricing page and its client-side estimator
// can use it. The seedable tiers' numbers are the single source of truth for
// lib/repositories/billing.ts's SEED_PLANS (imported there) so display and DB
// billing can never drift.
//
// Pricing philosophy (see the billing/pricing strategy doc): a flat SaaS
// subscription + a FLAT per-transaction overage once a plan's included volume
// is used up. PaySwift never takes a percentage of a merchant's sale.

export interface PricingTier {
  /** Stable key; matches Plan.name for seedable tiers. */
  name: 'Sandbox' | 'Starter' | 'Growth' | 'Scale' | 'Enterprise';
  /** KES/month (whole shillings). null = custom ("talk to sales"). */
  monthlyFee: number | null;
  /** Live transactions included per month. null = custom/negotiated. */
  includedTransactions: number | null;
  /** FLAT KES per transaction beyond the included volume. null = custom. */
  overageFeeKes: number | null;
  apiRateLimitPerMin?: number;
  tagline: string;
  audience: string;
  /** true = the plan actually collects money (has a real subscription). */
  billable: boolean;
  /** Visually featured in the pricing grid. */
  highlighted?: boolean;
}

export const ANNUAL_DISCOUNT = 0.15; // 15% off for annual, upfront billing (Growth & Scale)
export const DEFAULT_PAYOUT_APPROVAL_THRESHOLD_KES = 10000;
export const DEFAULT_LOW_BALANCE_THRESHOLD_KES = 1000;

/**
 * Representative of percentage-based M-Pesa aggregators such as
 * Pesapal/Flutterwave/DPO, not a specific competitor's exact published rate.
 */
export const DEFAULT_PERCENTAGE_PROVIDER_RATE = 0.03;

/**
 * Estimates what a merchant would have paid to a percentage-based competitor
 * for a given transaction volume.
 */
export function estimateComparisonCost(totalVolumeKes: number, benchmarkRate: number = DEFAULT_PERCENTAGE_PROVIDER_RATE): number {
  return Math.round(totalVolumeKes * benchmarkRate);
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Sandbox',
    monthlyFee: 0,
    includedTransactions: null,
    overageFeeKes: null,
    tagline: 'Unlimited test payments, free forever',
    audience: 'Anyone trying PaySwift out before going live',
    billable: false,
  },
  {
    name: 'Starter',
    monthlyFee: 0,
    includedTransactions: 100,
    overageFeeKes: 10,
    apiRateLimitPerMin: 60,
    tagline: 'Free to start — pay only a flat fee past 100 payments',
    audience: 'Boutiques and solo sellers just starting out',
    billable: true,
  },
  {
    name: 'Growth',
    monthlyFee: 2900,
    includedTransactions: 1000,
    overageFeeKes: 6,
    apiRateLimitPerMin: 300,
    tagline: 'For established small businesses and Shopify sellers',
    audience: 'Growing businesses that want branding, team members and Shopify',
    billable: true,
    highlighted: true,
  },
  {
    name: 'Scale',
    monthlyFee: 9900,
    includedTransactions: 10000,
    overageFeeKes: 3,
    apiRateLimitPerMin: 1200,
    tagline: 'For high-volume shops and bigger online stores',
    audience: 'Busy shops taking lots of payments every day',
    billable: true,
  },
  {
    name: 'Enterprise',
    monthlyFee: null,
    includedTransactions: null,
    overageFeeKes: null,
    tagline: 'Custom volume, your own branding, and a guaranteed service level',
    audience: 'Multi-branch businesses, marketplaces and large teams',
    billable: true,
  },
];

/** Seedable tiers = the concrete, fixed-price plans stored as Plan rows. */
export const SEEDABLE_TIERS = PRICING_TIERS.filter(
  (t): t is PricingTier & { monthlyFee: number; includedTransactions: number; overageFeeKes: number; apiRateLimitPerMin: number } =>
    t.billable && t.name !== 'Enterprise'
);

/**
 * Flat-fee monthly cost for a tier at a given transaction volume. Mirrors
 * lib/repositories/billing.ts computeInvoiceAmount, but pure/tier-shaped for
 * the marketing estimator. Returns null for custom (Enterprise) tiers.
 */
export function estimateMonthlyCost(tier: PricingTier, txPerMonth: number): number | null {
  if (tier.monthlyFee === null || tier.includedTransactions === null || tier.overageFeeKes === null) {
    return null;
  }
  const overage = Math.max(0, txPerMonth - tier.includedTransactions);
  return tier.monthlyFee + overage * tier.overageFeeKes;
}

/** The cheapest billable, non-custom tier for a given monthly volume. */
export function bestTierFor(txPerMonth: number): PricingTier {
  const billable = PRICING_TIERS.filter((t) => t.billable && t.name !== 'Enterprise' && t.name !== 'Sandbox');
  let best = billable[0];
  let bestCost = estimateMonthlyCost(best, txPerMonth) ?? Infinity;
  for (const t of billable) {
    const c = estimateMonthlyCost(t, txPerMonth);
    if (c !== null && c < bestCost) {
      best = t;
      bestCost = c;
    }
  }
  return best;
}

export interface FeatureRow {
  label: string;
  values: Record<PricingTier['name'], string | boolean>;
}

// Feature matrix from the strategy doc §3. Strings render as-is; booleans as ✓/—.
export const FEATURE_MATRIX: FeatureRow[] = [
  { label: 'Payment links, checkout page & QR codes', values: { Sandbox: true, Starter: true, Growth: true, Scale: true, Enterprise: true } },
  { label: '"Pay with M-Pesa" button', values: { Sandbox: true, Starter: true, Growth: true, Scale: true, Enterprise: true } },
  { label: 'Your logo & colours on checkout', values: { Sandbox: 'PaySwift', Starter: 'PaySwift', Growth: 'Your branding', Scale: 'Your branding', Enterprise: 'Fully your own' } },
  { label: 'Team members', values: { Sandbox: '1', Starter: '1', Growth: '3', Scale: 'Unlimited', Enterprise: 'Unlimited' } },
  { label: 'Connect your Shopify store', values: { Sandbox: true, Starter: false, Growth: true, Scale: true, Enterprise: true } },
  { label: 'Instant payment alerts', values: { Sandbox: true, Starter: 'View', Growth: 'Resend & test', Scale: 'Resend & test', Enterprise: 'Custom' } },
  { label: 'Send refunds & payouts', values: { Sandbox: 'Test only', Starter: false, Growth: false, Scale: true, Enterprise: true } },
  { label: 'Developer API', values: { Sandbox: 'Test only', Starter: 'View only', Growth: 'Full', Scale: 'Full (higher limit)', Enterprise: 'Full (custom limit)' } },
  { label: 'Support', values: { Sandbox: 'Help centre', Starter: 'Email', Growth: 'Priority email', Scale: 'Phone / WhatsApp', Enterprise: 'Dedicated manager' } },
  { label: 'Guaranteed uptime', values: { Sandbox: false, Starter: false, Growth: false, Scale: 'Published target', Enterprise: 'In your contract' } },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  { q: 'Does this cost my customers anything?', a: "No. Your customers pay exactly what they'd pay into any M-Pesa Till — PaySwift never adds a fee to their side of the transaction." },
  { q: 'Why not just use a Till number for free?', a: "For the very simplest case, a plain Till is cheaper — and we'll say so. What you pay PaySwift for is the dashboard, no-code payment links and QR codes, Shopify, automatic record-keeping and instant alerts for every sale — not a lower rate per payment. We don't take a cut of your sales at all." },
  { q: "What happens if I go over my plan's transaction limit?", a: 'Nothing is suspended. You simply pay a small flat fee per extra transaction (KES 10 on Starter, KES 6 on Growth, KES 3 on Scale) — never a percentage of the sale, and never a surprise cutoff.' },
  { q: 'Can I change plans anytime?', a: "Yes. Upgrades and downgrades take effect immediately and are prorated — you're only charged the difference for the remainder of the current cycle." },
  { q: 'How do I pay?', a: 'By M-Pesa. On renewal we send an STK Push prompt to your billing number; you approve it with your PIN, exactly like any other M-Pesa payment. No card required.' },
];
