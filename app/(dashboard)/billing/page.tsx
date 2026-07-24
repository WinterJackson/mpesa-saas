import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { getSubscriptionForOrganization, getCurrentPeriodProjection } from '@/lib/repositories/billing';
import { PRICING_TIERS } from '@/lib/pricing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Billing - PaySwift',
  description: 'Your plan, usage, and invoice history.',
};

function kes(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`;
}

export default async function BillingPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  const context = await getOrganizationContext(userId, orgId);
  if (!context) redirect('/onboarding');

  const subscription = await getSubscriptionForOrganization(context.organization.id);
  const projection = subscription
    ? await getCurrentPeriodProjection({
        organizationId: context.organization.id,
        currentPeriodEnd: subscription.currentPeriodEnd,
        plan: subscription.plan,
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          A predictable monthly plan plus a small flat fee per payment beyond your included volume —
          never a percentage of your sales. Collection is handled manually while we finish our
          payment-provider integration.
        </p>
      </div>

      {!subscription ? (
        <p className="text-sm text-muted-foreground">No subscription found for this organization yet.</p>
      ) : (
        <>
          {/* Current plan + this-period projection */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardDescription>Current plan</CardDescription>
                <CardTitle className="text-2xl">{subscription.plan.name}</CardTitle>
              </div>
              <Badge variant={subscription.status === 'active' ? 'default' : 'destructive'} className="capitalize">
                {subscription.status.replace('_', ' ')}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="text-muted-foreground space-y-1">
                <p>
                  {kes(subscription.plan.monthlyFee)}/month · {subscription.plan.includedTransactions.toLocaleString('en-KE')} payments
                  included, then {kes(subscription.plan.overageFeeKes)} per extra payment
                </p>
                <p>Renews {subscription.currentPeriodEnd.toLocaleDateString()}</p>
              </div>

              {projection && (
                <UsageMeter
                  used={projection.txCount}
                  included={subscription.plan.includedTransactions}
                  overageCount={projection.overageCount}
                  overageFeeKes={subscription.plan.overageFeeKes}
                  projectedAmount={projection.projectedAmount}
                  monthlyFee={subscription.plan.monthlyFee}
                />
              )}
            </CardContent>
          </Card>

          {/* Plan comparison */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base">Compare plans</CardTitle>
              <Link href="/pricing" className="shrink-0">
                <Button variant="outline" size="sm">
                  Full pricing <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {PRICING_TIERS.filter((t) => t.name !== 'Sandbox').map((tier) => {
                  const isCurrent = tier.name === subscription.plan.name;
                  return (
                    <div
                      key={tier.name}
                      className={`rounded-xl border p-4 ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`}
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
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Changing plans isn&apos;t self-service yet — contact us and we&apos;ll switch you over,
                effective immediately and prorated.
              </p>
            </CardContent>
          </Card>

          {/* Usage history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage history</CardTitle>
              <CardDescription>Completed billing periods. The current period is shown above.</CardDescription>
            </CardHeader>
            <CardContent>
              {subscription.usageRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground">No completed periods yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Payments</TableHead>
                      <TableHead className="text-right">Volume (KES)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscription.usageRecords.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          {u.periodStart.toLocaleDateString()} – {u.periodEnd.toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">{u.txCount.toLocaleString('en-KE')}</TableCell>
                        <TableCell className="text-right">{u.txVolume.toLocaleString('en-KE')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {subscription.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices issued yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issued</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscription.invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{invoice.issuedAt.toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">{invoice.amount.toLocaleString('en-KE')}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invoice.status === 'paid'
                                ? 'default'
                                : invoice.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function UsageMeter({
  used,
  included,
  overageCount,
  overageFeeKes,
  projectedAmount,
  monthlyFee,
}: {
  used: number;
  included: number;
  overageCount: number;
  overageFeeKes: number;
  projectedAmount: number;
  monthlyFee: number;
}) {
  const pct = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : used > 0 ? 100 : 0;
  const overBudget = overageCount > 0;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-foreground">This period&apos;s usage</p>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">{used.toLocaleString('en-KE')}</span> /{' '}
          {included.toLocaleString('en-KE')} included payments
        </p>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all ${overBudget ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {overBudget ? (
            <>
              <span className="font-medium text-foreground">{overageCount.toLocaleString('en-KE')}</span> over
              your included volume — {kes(overageFeeKes)} each
            </>
          ) : (
            <>{(included - used).toLocaleString('en-KE')} payments remaining before overage</>
          )}
        </p>
        <p>
          <span className="text-muted-foreground">Projected this period: </span>
          <span className="font-semibold text-foreground">{kes(projectedAmount)}</span>
          {overBudget && (
            <span className="text-muted-foreground">
              {' '}
              ({kes(monthlyFee)} + {kes(projectedAmount - monthlyFee)} overage)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
