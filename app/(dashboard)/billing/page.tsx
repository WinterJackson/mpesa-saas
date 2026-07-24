import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { getSubscriptionForOrganization } from '@/lib/repositories/billing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Billing - PaySwift',
  description: 'Your plan, usage, and invoice history.',
};

export default async function BillingPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  const context = await getOrganizationContext(userId, orgId);
  if (!context) redirect('/onboarding');

  const subscription = await getSubscriptionForOrganization(context.organization.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Collection is handled manually while we finish our payment-provider integration — an invoice
          appears here each billing period and our team will follow up to collect it.
        </p>
      </div>

      {!subscription ? (
        <p className="text-sm text-muted-foreground">No subscription found for this organization yet.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardDescription>Current plan</CardDescription>
              <CardTitle className="text-2xl">{subscription.plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>KES {subscription.plan.monthlyFee.toLocaleString()}/month · {subscription.plan.includedTransactions.toLocaleString()} transactions included, then KES {subscription.plan.overageFeeKes} per extra transaction</p>
              <p>Renews {subscription.currentPeriodEnd.toLocaleDateString()}</p>
              <p>Status: <span className="capitalize">{subscription.status}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent usage</CardTitle>
            </CardHeader>
            <CardContent>
              {subscription.usageRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Volume (KES)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscription.usageRecords.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.periodStart.toLocaleDateString()} – {u.periodEnd.toLocaleDateString()}</TableCell>
                        <TableCell>{u.txCount}</TableCell>
                        <TableCell>{u.txVolume.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

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
                      <TableHead>Amount (KES)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscription.invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{invoice.issuedAt.toLocaleDateString()}</TableCell>
                        <TableCell>{invoice.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'failed' ? 'destructive' : 'secondary'}>
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
