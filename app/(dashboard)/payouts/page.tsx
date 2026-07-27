import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listPayouts } from '@/lib/repositories/payouts';
import { listRefunds } from '@/lib/repositories/refunds';
import { listTransactionsPage } from '@/lib/repositories/transactions';
import { latestBalanceSnapshot } from '@/lib/repositories/account-balance';
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
  if (!context) return null;


  // Payouts move money out — owner/admin/finance only (developer uses the API).
  if (!PAYOUT_ROLES.includes(context.membership.role)) {
    redirect('/dashboard');
  }

  const viewEnv = await getViewEnvironment(context.merchant?.environment);

  const [payouts, refunds, refundablePage, balanceSnapshot] = await Promise.all([
    listPayouts(context.organization.id, { take: 50 }),
    listRefunds(context.organization.id, { take: 50 }),
    listTransactionsPage(context.organization.id, { limit: 25, status: 'completed', environment: viewEnv }),
    latestBalanceSnapshot(context.organization.id),
  ]);

  // Only surface a balance for the environment currently in view.
  const lastBalance =
    balanceSnapshot && balanceSnapshot.environment === viewEnv
      ? { workingBalance: balanceSnapshot.workingBalance, checkedAt: balanceSnapshot.createdAt.toISOString() }
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payouts &amp; Refunds</h1>
        <p className="text-muted-foreground mt-1">
          Send money to any M-Pesa number, or refund a customer&apos;s payment.
        </p>
      </div>

      <PayoutsView
        environment={viewEnv ?? context.merchant?.environment ?? 'sandbox'}
        lastBalance={lastBalance}
        currentUserId={userId}
        currentUserRole={context.membership.role}
        payouts={payouts.map((p) => ({
          id: p.id,
          amount: p.amount,
          phone: p.phone,
          status: p.status,
          remarks: p.remarks,
          mpesaReceipt: p.mpesaReceipt,
          createdAt: p.createdAt.toISOString(),
          approvalStatus: p.approvalStatus,
          initiatedByUserId: p.initiatedByUserId,
          approvedByUserId: p.approvedByUserId,
          rejectedByUserId: p.rejectedByUserId,
          rejectionReason: p.rejectionReason,
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
