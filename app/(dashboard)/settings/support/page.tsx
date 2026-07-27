import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { SupportPanel } from "@/components/support/support-panel";

export const metadata = {
  title: "Support - PaySwift",
  description: "Get help with your PaySwift account",
};

export default async function SupportSettingsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const context = await getOrganizationContext(userId, orgId);
  if (!context) return null;


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Support</h2>
        <p className="text-muted-foreground mt-1">
          Questions, issues or feedback? We&apos;re one message away.
        </p>
      </div>

      <SupportPanel context={`my ${context.organization.businessName} account`} />
    </div>
  );
}
