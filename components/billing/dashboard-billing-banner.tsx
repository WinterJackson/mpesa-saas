'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Slim, dashboard-wide banner that directs a merchant to pay when their
 * subscription needs it — a paid plan awaiting its first payment (`incomplete`),
 * a failed renewal (`past_due`), or a soft-locked one (`suspended`). Hidden on
 * the Billing page itself, which already shows a richer prompt.
 */
export function DashboardBillingBanner({
  status,
  planName,
}: {
  status: 'incomplete' | 'past_due' | 'suspended';
  planName: string;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith('/billing')) return null;

  const copy =
    status === 'incomplete'
      ? {
          title: `Activate your ${planName} plan`,
          detail: 'Complete your first M-Pesa payment to unlock it.',
          cta: 'Pay & activate',
        }
      : status === 'past_due'
        ? {
            title: 'Subscription payment failed',
            detail: 'Pay now to keep your account active.',
            cta: 'Pay now',
          }
        : {
            title: 'Your subscription is paused',
            detail: 'Settle your invoice to restore full access.',
            cta: 'Reactivate',
          };

  const tone =
    status === 'suspended'
      ? 'border-destructive/40 bg-destructive/10'
      : 'border-amber-500/40 bg-amber-500/10';

  return (
    <div className={`mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${tone}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={`mt-0.5 size-5 shrink-0 ${status === 'suspended' ? 'text-destructive' : 'text-amber-600'}`}
        />
        <div className="text-sm">
          <p className="font-medium text-foreground">{copy.title}</p>
          <p className="text-muted-foreground">{copy.detail}</p>
        </div>
      </div>
      <Link
        href="/billing"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {copy.cta} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
