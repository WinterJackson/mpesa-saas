'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PRICING_TIERS } from '@/lib/pricing';
import { changePlanAction } from '@/lib/actions/billing';

function kes(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`;
}

const ORDER: Record<string, number> = { Starter: 0, Growth: 1, Scale: 2, Enterprise: 3 };

/**
 * Self-service plan switcher on the Billing page. Renders every non-Sandbox tier
 * with an action button that calls `changePlanAction`. Enterprise stays a "talk
 * to sales" link; the current plan is marked and not switchable.
 */
export function PlanChange({
  currentPlanName,
  canManage,
  initialPlan = null,
}: {
  currentPlanName: string;
  canManage: boolean;
  initialPlan?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [targetName, setTargetName] = useState<string | null>(null);

  function change(name: string) {
    setTargetName(name);
    startTransition(async () => {
      const res = await changePlanAction(name);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
      setTargetName(null);
    });
  }

  const currentRank = ORDER[currentPlanName] ?? 0;
  const tiers = PRICING_TIERS.filter((t) => t.name !== 'Sandbox');

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => {
          const isCurrent = tier.name === currentPlanName;
          const isEnterprise = tier.name === 'Enterprise';
          const isHighlighted = tier.name === initialPlan && !isCurrent;
          const rank = ORDER[tier.name] ?? 0;
          const verb = isEnterprise
            ? 'Contact sales'
            : rank > currentRank
              ? `Upgrade to ${tier.name}`
              : `Switch to ${tier.name}`;

          return (
            <div
              key={tier.name}
              className={cn(
                'rounded-xl border p-4',
                isCurrent
                  ? 'border-primary bg-primary/5'
                  : isHighlighted
                    ? 'border-primary/60 ring-2 ring-primary/30'
                    : 'border-border'
              )}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{tier.name}</p>
                {isCurrent && (
                  <Badge variant="default" className="text-xs">
                    <Check className="mr-1 size-3" /> Current
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-lg font-bold">
                {tier.monthlyFee === null
                  ? 'Custom'
                  : tier.monthlyFee === 0
                    ? 'Free'
                    : `${kes(tier.monthlyFee)}/mo`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tier.includedTransactions !== null
                  ? `${tier.includedTransactions.toLocaleString('en-KE')} payments, then ${kes(tier.overageFeeKes ?? 0)} each`
                  : tier.tagline}
              </p>

              <div className="mt-4">
                {isCurrent ? (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    Your plan
                  </Button>
                ) : isEnterprise ? (
                  <a href="mailto:sales@payswift.co.ke" className="block">
                    <Button variant="outline" size="sm" className="w-full">
                      Contact sales
                    </Button>
                  </a>
                ) : (
                  <Button
                    variant={isHighlighted ? 'default' : 'outline'}
                    size="sm"
                    className="w-full"
                    disabled={!canManage || pending}
                    onClick={() => change(tier.name)}
                  >
                    {pending && targetName === tier.name ? 'Switching…' : verb}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {canManage
          ? 'Changes take effect immediately. Moving to a paid plan issues an invoice you pay by M-Pesa STK Push — the plan activates as soon as payment is confirmed.'
          : 'Only owners, admins and finance members can change the plan.'}
      </p>
    </>
  );
}
