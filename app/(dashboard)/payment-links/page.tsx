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
  if (!context) redirect('/onboarding');

  const viewEnv = await getViewEnvironment(context.merchant?.environment);
  const links = await listPaymentLinks(context.organization.id, { environment: viewEnv });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payment Links</h1>
        <p className="text-sm text-muted-foreground">
          Create a shareable link or QR code and start collecting M-Pesa payments — no code required.
        </p>
      </div>
      <PaymentLinksView initialLinks={links} currentRole={context.membership.role} />
    </div>
  );
}
