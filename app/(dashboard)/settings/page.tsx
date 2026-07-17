import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { WebhookCard } from "@/components/settings/webhook-card";
import { EnvironmentCard } from "@/components/settings/environment-card";

export const metadata = {
  title: "Settings - PaySwift",
  description: "Manage your M-Pesa integration settings",
};

export default async function SettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const merchant = await prisma.merchant.findUnique({
    where: { clerkUserId: userId },
    include: {
      apiKeys: {
        where: { revoked: false },
        take: 1,
      },
    },
  });

  if (!merchant) {
    redirect("/onboarding");
  }

  const activeKey = merchant.apiKeys[0]?.key || "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your API keys, webhooks, and environment preferences.
        </p>
      </div>

      <div className="grid gap-6">
        <ApiKeyCard initialKey={activeKey} />
        <WebhookCard initialUrl={merchant.webhookUrl} />
        <EnvironmentCard initialEnvironment={merchant.environment as "sandbox" | "live"} />
      </div>
    </div>
  );
}
