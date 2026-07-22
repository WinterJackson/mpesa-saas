import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { decryptSecret } from "@/lib/crypto";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { findActiveApiKey } from "@/lib/repositories/api-keys";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { WebhookCard } from "@/components/settings/webhook-card";
import { EnvironmentCard } from "@/components/settings/environment-card";
import { ShopifyCard } from "@/components/settings/shopify-card";

export const metadata = {
  title: "Settings - PaySwift",
  description: "Manage your M-Pesa integration settings",
};

export default async function SettingsPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const context = await getOrganizationContext(userId, orgId);

  if (!context || !context.merchant) {
    redirect("/onboarding");
  }

  const merchant = context.merchant;
  const activeKey = await findActiveApiKey(context.organization.id);
  const activeKeyPrefix = activeKey?.keyPrefix || "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your API keys, webhooks, and environment preferences.
        </p>
      </div>

      <div className="grid gap-6">
        <ApiKeyCard initialKeyPrefix={activeKeyPrefix} />
        <WebhookCard initialUrl={merchant.webhookUrl} initialSecret={merchant.webhookSecret ? decryptSecret(merchant.webhookSecret) : null} />
        <EnvironmentCard initialEnvironment={merchant.environment as "sandbox" | "live"} />
        <ShopifyCard 
          initialDomain={merchant.shopifyShopDomain} 
          initialToken={merchant.shopifyAdminAccessToken ? decryptSecret(merchant.shopifyAdminAccessToken) : null} 
          initialSecret={merchant.shopifyWebhookSecret ? decryptSecret(merchant.shopifyWebhookSecret) : null} 
        />
      </div>
    </div>
  );
}
