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
import { CollapsibleSection } from "@/components/settings/collapsible-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Plug, Wallet, Code2, Blocks, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Settings - PaySwift",
  description: "Manage your M-Pesa integration settings",
};

/** A numbered step chip shown above each "go live" essential. */
function StepLabel({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 className="size-4" /> : n}
      </span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

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

  const kycStatus = context.organization.kycStatus;
  const kycApproved = kycStatus === "approved";
  const hasLiveCredentials = Boolean(credentialSummary?.hasLiveCredentials);
  const isLive = merchant.environment === "live";

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Everything that connects your business to M-Pesa lives here. Each option has a plain-language
          &ldquo;What is this?&rdquo; explainer — and if you use Payment Links or Shopify, you can safely skip
          the developer sections.
        </p>
      </div>

      {/* ── Essentials: getting ready to accept real payments ───────────────── */}
      <section className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Start accepting real payments</h3>
            <p className="text-sm text-muted-foreground">
              Three steps take you from safe testing to collecting real money. Do them in order — we&apos;ll
              guide you through each one.
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <div>
            <StepLabel n={1} done={kycApproved}>
              Verify your business
            </StepLabel>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="size-5" />
                  Business verification (KYC)
                </CardTitle>
                <CardDescription>
                  Safaricom and Kenyan law require us to confirm who you are before you can collect real
                  M-Pesa payments. Upload your ID, business registration and KRA PIN — it&apos;s a one-time
                  check.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Badge
                  variant={kycApproved ? "default" : kycStatus === "rejected" ? "destructive" : "secondary"}
                  className="capitalize"
                >
                  {kycStatus}
                </Badge>
                <Link href="/settings/kyc" className="text-sm font-medium text-primary hover:underline">
                  Manage documents →
                </Link>
              </CardContent>
            </Card>
          </div>

          <div>
            <StepLabel n={2} done={hasLiveCredentials}>
              Connect your M-Pesa
            </StepLabel>
            {credentialSummary && (
              <DarajaCredentialsCard
                sandboxShortcode={credentialSummary.sandboxShortcode}
                isPooledSandbox={credentialSummary.isPooledSandbox}
                liveShortcode={credentialSummary.liveShortcode}
                hasLiveCredentials={credentialSummary.hasLiveCredentials}
              />
            )}
          </div>

          <div>
            <StepLabel n={3} done={isLive}>
              Switch to live
            </StepLabel>
            <EnvironmentCard initialEnvironment={merchant.environment as "sandbox" | "live"} />
          </div>
        </div>
      </section>

      {/* ── Developer tools: optional, collapsed by default ─────────────────── */}
      <CollapsibleSection
        title="Developer tools"
        badge="Optional"
        icon={<Code2 className="size-5" />}
        description="For building a custom checkout on your own website. Most stores never need this."
      >
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Not a developer? You can skip this section.</p>
          <p className="mt-1">
            You don&apos;t need an API key or webhooks to get paid. Use{" "}
            <Link href="/payment-links" className="font-medium text-primary hover:underline">
              Payment Links
            </Link>{" "}
            for a no-code payment page, or the{" "}
            <Link href="/integrations" className="font-medium text-primary hover:underline">
              Shopify app
            </Link>{" "}
            to collect payment on your store automatically. These tools are here only for developers wiring
            PaySwift into custom software.
          </p>
        </div>

        <ApiKeyCard initialKeyPrefix={activeKeyPrefix} initialScope={activeKeyScope} currentRole={currentRole} />
        <WebhookCard
          initialUrl={merchant.webhookUrl}
          initialSecret={merchant.webhookSecret ? decryptSecret(merchant.webhookSecret) : null}
        />
      </CollapsibleSection>

      {/* ── Integrations ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Blocks className="size-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Integrations</h3>
            <p className="text-sm text-muted-foreground">
              Connect PaySwift to the tools you already use — no code required.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="size-5" />
              Shopify
            </CardTitle>
            <CardDescription>
              Connect your Shopify store in one click so new orders automatically collect payment with
              M-Pesa — no coding needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/integrations" className="text-sm font-medium text-primary hover:underline">
              Go to Integrations →
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
