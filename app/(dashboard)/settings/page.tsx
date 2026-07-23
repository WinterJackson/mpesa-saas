import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { decryptSecret } from "@/lib/crypto";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { findActiveApiKey } from "@/lib/repositories/api-keys";
import { getCredentialSummary } from "@/lib/repositories/daraja-credentials";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { WebhookCard } from "@/components/settings/webhook-card";
import { EnvironmentCard } from "@/components/settings/environment-card";
import { DarajaCredentialsCard } from "@/components/settings/daraja-credentials-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Plug } from "lucide-react";

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
  const activeKeyScope = activeKey?.scope || "read_write";
  const currentRole = context.membership.role;
  const credentialSummary = await getCredentialSummary(context.organization.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your API keys, webhooks, and environment preferences.
        </p>
      </div>

      <div className="grid gap-6">
        <ApiKeyCard initialKeyPrefix={activeKeyPrefix} initialScope={activeKeyScope} currentRole={currentRole} />
        <WebhookCard initialUrl={merchant.webhookUrl} initialSecret={merchant.webhookSecret ? decryptSecret(merchant.webhookSecret) : null} />
        <EnvironmentCard initialEnvironment={merchant.environment as "sandbox" | "live"} />
        {credentialSummary && (
          <DarajaCredentialsCard
            sandboxShortcode={credentialSummary.sandboxShortcode}
            isPooledSandbox={credentialSummary.isPooledSandbox}
            liveShortcode={credentialSummary.liveShortcode}
            hasLiveCredentials={credentialSummary.hasLiveCredentials}
          />
        )}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="size-5" />
              KYC Verification
            </CardTitle>
            <CardDescription>Required before going live with real M-Pesa payments.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Badge variant={context.organization.kycStatus === "approved" ? "default" : context.organization.kycStatus === "rejected" ? "destructive" : "secondary"} className="capitalize">
              {context.organization.kycStatus}
            </Badge>
            <Link href="/settings/kyc" className="text-sm font-medium text-primary hover:underline">
              Manage documents →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="size-5" />
              Shopify Integration
            </CardTitle>
            <CardDescription>
              Connect your Shopify store in one click so new orders automatically collect payment with
              M-Pesa. Manage it from the Integrations page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/integrations" className="text-sm font-medium text-primary hover:underline">
              Go to Integrations →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
