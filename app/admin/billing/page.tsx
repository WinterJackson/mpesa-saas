import { listAllInvoices, getAdminBillingOverview } from '@/lib/repositories/billing';
import { getArpm, getCohortRetention, getDunningRecoveryRate } from '@/lib/repositories/admin-analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MarkInvoicePaidButton } from '@/components/admin/mark-invoice-paid-button';

export const metadata = {
  title: 'Billing - PaySwift Admin',
};

function kes(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`;
}

export default async function AdminBillingPage() {
  const [overview, invoices, arpm, cohortRetention, dunningRecovery] = await Promise.all([
    getAdminBillingOverview(),
    listAllInvoices(),
    getArpm(),
    getCohortRetention(),
    getDunningRecoveryRate(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Recurring revenue, at-risk accounts, and invoice collection. Marking an invoice paid also
          reactivates a dunned subscription. All actions are audit-logged.
        </p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly recurring revenue</CardDescription>
            <CardTitle className="text-3xl">{kes(overview.mrr)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Active + past-due subscriptions at plan price
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active subscriptions</CardDescription>
            <CardTitle className="text-3xl">{overview.activeCount.toLocaleString('en-KE')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            of {overview.totalSubscriptions.toLocaleString('en-KE')} total
          </CardContent>
        </Card>
        <Card className={overview.atRiskCount > 0 ? 'border-amber-500/40' : undefined}>
          <CardHeader className="pb-2">
            <CardDescription>At-risk accounts</CardDescription>
            <CardTitle className="text-3xl">{overview.atRiskCount.toLocaleString('en-KE')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Past-due or suspended</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ARPM (monthly)</CardDescription>
            <CardTitle className="text-3xl">{kes(arpm.arpm)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            MRR ÷ {arpm.payingCount} paying subscriptions
          </CardContent>
        </Card>
      </div>

      {/* Segment revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by plan</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.byPlan.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paying subscriptions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Subscribers</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.byPlan.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{kes(p.monthlyFee)}/mo</TableCell>
                    <TableCell className="text-right">{p.count.toLocaleString('en-KE')}</TableCell>
                    <TableCell className="text-right font-medium">{kes(p.mrr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cohort Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cohort retention</CardTitle>
          <CardDescription>
            Retention to date, not a normalized N-month curve — cohorts of different ages aren&apos;t directly comparable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cohortRetention.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations onboarded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohort</TableHead>
                  <TableHead className="text-right">Signed up</TableHead>
                  <TableHead className="text-right">Still active/past-due</TableHead>
                  <TableHead className="text-right">Retention %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortRetention.map((row) => (
                  <TableRow key={row.cohort}>
                    <TableCell className="font-medium">{row.cohort}</TableCell>
                    <TableCell className="text-right">{row.totalOrganizations.toLocaleString('en-KE')}</TableCell>
                    <TableCell className="text-right">{row.retained.toLocaleString('en-KE')}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.retentionPct !== null ? `${Math.round(row.retentionPct)}%` : '—'}
                      <span className="ml-2 font-normal text-muted-foreground">
                        ({row.cohortAgeMonths} mo. old cohort)
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dunning Recovery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dunning recovery</CardTitle>
          <CardDescription>
            Approximated from invoice retry counts (no per-attempt history is stored) — counts invoices that eventually succeeded after at least one failed attempt, not time-to-recovery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-semibold">
              {dunningRecovery.recoveryRatePct !== null ? `${Math.round(dunningRecovery.recoveryRatePct)}%` : '—'}
            </span>
            <span className="text-sm text-muted-foreground">
              {dunningRecovery.recovered} recovered of {dunningRecovery.invoicesWithRetries} retried invoices
            </span>
          </div>
        </CardContent>
      </Card>

      {/* At-risk accounts */}
      {overview.atRisk.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">At-risk accounts</CardTitle>
            <CardDescription>
              Failed collection — in grace or suspended. Confirm payment, then mark the invoice paid to reactivate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Grace ends</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.atRisk.map((a) => (
                  <TableRow key={a.subscriptionId}>
                    <TableCell className="font-medium">{a.businessName}</TableCell>
                    <TableCell>{a.planName}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'suspended' ? 'destructive' : 'secondary'}>
                        {a.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.gracePeriodEnd ? a.gracePeriodEnd.toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.outstandingAmount !== null ? kes(a.outstandingAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.outstandingInvoiceId && <MarkInvoicePaidButton invoiceId={a.outstandingInvoiceId} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
          <CardDescription>Confirm out-of-band payment, then mark unpaid invoices paid.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right">Amount (KES)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.subscription.organization.businessName}</TableCell>
                  <TableCell className="text-right">{invoice.amount.toLocaleString('en-KE')}</TableCell>
                  <TableCell>
                    <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'failed' ? 'destructive' : 'secondary'}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{invoice.issuedAt.toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {(invoice.status === 'pending' || invoice.status === 'failed') && (
                      <MarkInvoicePaidButton invoiceId={invoice.id} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
