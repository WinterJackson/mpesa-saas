import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { decryptSecret } from '@/lib/crypto';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { getShopifyAppConfig } from '@/lib/shopify';
import { ShopifyConnectWizard } from '@/components/integrations/shopify-connect-wizard';
import { ShopifyCard } from '@/components/settings/shopify-card';

export const metadata = {
  title: 'Integrations - PaySwift',
  description: 'Connect your store to accept M-Pesa payments automatically.',
};

export default async function IntegrationsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  const context = await getOrganizationContext(userId, orgId);
  if (!context || !context.merchant) redirect('/onboarding');

  const merchant = context.merchant;
  const currentRole = context.membership.role;
  const canManage = ['owner', 'admin', 'developer'].includes(currentRole);
  const connected = Boolean(merchant.shopifyShopDomain && merchant.shopifyAdminAccessToken);
  const oauthConfigured = getShopifyAppConfig() !== null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect your store so orders automatically collect payment with M-Pesa.
        </p>
      </div>

      <Suspense fallback={null}>
        <ShopifyConnectWizard
          connected={connected}
          shopDomain={merchant.shopifyShopDomain}
          oauthConfigured={oauthConfigured}
          canManage={canManage}
        />
      </Suspense>

      {!connected && (
        <details className="rounded-lg border border-border bg-background">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
            Advanced: connect manually with an Admin API access token
          </summary>
          <div className="p-4 pt-0">
            <ShopifyCard
              initialDomain={merchant.shopifyShopDomain}
              initialToken={merchant.shopifyAdminAccessToken ? decryptSecret(merchant.shopifyAdminAccessToken) : null}
              initialSecret={merchant.shopifyWebhookSecret ? decryptSecret(merchant.shopifyWebhookSecret) : null}
            />
          </div>
        </details>
      )}
    </div>
  );
}
