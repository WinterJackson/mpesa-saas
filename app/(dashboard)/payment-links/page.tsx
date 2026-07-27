import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listPaymentLinks } from '@/lib/repositories/payment-links';
import { getViewEnvironment } from '@/lib/view-env';
import { PaymentLinksView } from '@/components/payment-links/payment-links-view';

export const metadata = {
  title: 'Payment Links - PaySwift',
  description: 'Create shareable M-Pesa payment links — no code required.',
};

export default async function PaymentLinksPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return null;


  const viewEnv = await getViewEnvironment(context.merchant?.environment);
  const links = await listPaymentLinks(context.organization.id, { environment: viewEnv });
  const businessName = context.merchant?.businessName ?? context.organization.businessName;

  return (
    <PaymentLinksView
      initialLinks={links.map((l) => ({
        ...l,
        expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
      }))}
      currentRole={context.membership.role}
      businessName={businessName}
    />
  );
}
