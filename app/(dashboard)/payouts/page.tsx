import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listPayouts } from '@/lib/repositories/payouts';
import { listRefunds } from '@/lib/repositories/refunds';
import { listTransactionsPage } from '@/lib/repositories/transactions';
import { getViewEnvironment } from '@/lib/view-env';
import { PayoutsView } from '@/components/payouts/payouts-view';

export const metadata = {
  title: 'Payouts & Refunds - PaySwift',
  description: 'Send money to customers and refund payments.',
};

const PAYOUT_ROLES = ['owner', 'admin', 'finance'];

export default async function PayoutsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  const context = await getOrganizationContext(userId, orgId);
  if (!context) redirect('/onboarding');

  // Payouts move money out — owner/admin/finance only (developer uses the API).
  if (!PAYOUT_ROLES.includes(context.membership.role)) {
    redirect('/dashboard');
  }

  const viewEnv = await getViewEnvironment(context.merchant?.environment);

  const [payouts, refunds, refundablePage] = await Promise.all([
    listPayouts(context.organization.id, { take: 50 }),
    listRefunds(context.organization.id, { take: 50 }),
    listTransactionsPage(context.organization.id, { limit: 25, status: 'completed', environment: viewEnv }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payouts &amp; Refunds</h1>
        <p className="text-sm text-muted-foreground">
          Send money to any M-Pesa number, or refund a customer&apos;s payment.
        </p>
      </div>

      <PayoutsView
        environment={viewEnv ?? context.merchant?.environment ?? 'sandbox'}
        payouts={payouts.map((p) => ({
          id: p.id,
          amount: p.amount,
          phone: p.phone,
          status: p.status,
          remarks: p.remarks,
          mpesaReceipt: p.mpesaReceipt,
          createdAt: p.createdAt.toISOString(),
        }))}
        refunds={refunds.map((r) => ({
          id: r.id,
          amount: r.amount,
          phone: r.phone,
          status: r.status,
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
        }))}
        refundable={refundablePage.data.map((t) => ({
          id: t.id,
          amount: t.amount,
          phone: t.phone,
          orderReference: t.orderReference,
          mpesaReceipt: t.mpesaReceipt,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
