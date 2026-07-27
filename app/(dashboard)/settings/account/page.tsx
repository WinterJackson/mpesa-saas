import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { BusinessProfileCard } from "@/components/settings/business-profile-card";
import { ClerkProfile } from "@/components/account/clerk-profile";

export const metadata = {
  title: "Account Settings - PaySwift",
  description: "Manage your personal profile and business details",
};

export default async function AccountSettingsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const context = await getOrganizationContext(userId, orgId);
  if (!context?.merchant) redirect("/onboarding");

  const businessName = context.merchant.businessName ?? context.organization.businessName;
  const canEditBusiness = ["owner", "admin"].includes(context.membership.role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Account</h2>
        <p className="text-muted-foreground mt-1">
          Manage your personal profile, security and business details.
        </p>
      </div>

      <BusinessProfileCard initialBusinessName={businessName} canEdit={canEditBusiness} />

      <div>
        <h3 className="text-lg font-semibold tracking-tight">Personal profile &amp; security</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Your name, email, password and two-factor authentication are managed here.
        </p>
        <ClerkProfile />
      </div>
    </div>
  );
}
