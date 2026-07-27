import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listDeliveries } from '@/lib/repositories/webhook-deliveries';
import { WebhookInspector } from '@/components/settings/webhook-inspector';

export const metadata = {
  title: 'Webhook Deliveries - PaySwift',
  description: 'Inspect and redeliver webhook events.',
};

export default async function WebhookDeliveriesPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  const context = await getOrganizationContext(userId, orgId);
  if (!context?.merchant) redirect('/onboarding');

  const page = await listDeliveries(context.organization.id, { limit: 25 });
  const canManage = ['owner', 'admin'].includes(context.membership.role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Webhook deliveries</h2>
        <p className="text-muted-foreground mt-1">
          Every event PaySwift has sent to your endpoint — inspect payloads, HTTP responses, and
          redeliver failed events.
        </p>
      </div>
      <WebhookInspector
        initialDeliveries={JSON.parse(JSON.stringify(page.data))}
        initialNextCursor={page.nextCursor}
        hasWebhookUrl={Boolean(context.merchant.webhookUrl)}
        canManage={canManage}
      />
    </div>
  );
}
