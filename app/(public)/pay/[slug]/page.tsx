import { after } from 'next/server';
import { findActiveLinkBySlug, incrementLinkViewBySlug } from '@/lib/repositories/payment-links';
import { PayCheckoutClient } from './pay-checkout-client';

export const metadata = {
  title: 'Pay with M-Pesa | PaySwift',
  description: 'Securely complete your M-Pesa payment.',
};

export default async function PayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = await findActiveLinkBySlug(slug);

  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Payment link unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This payment link doesn&apos;t exist, has been deactivated, or has expired. Please check
            with the seller for an up-to-date link.
          </p>
        </div>
      </div>
    );
  }

  // Count the checkout view for the link's conversion rate — post-response and
  // best-effort, so it never slows or breaks the customer's payment page.
  after(async () => {
    try {
      await incrementLinkViewBySlug(slug);
    } catch {
      /* view tracking is non-critical */
    }
  });

  return (
    <PayCheckoutClient
      slug={slug}
      title={link.title}
      description={link.description}
      amountType={link.amountType}
      amount={link.amount}
      businessName={link.merchant.businessName}
    />
  );
}
