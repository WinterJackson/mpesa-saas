import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { getNotificationPreferences } from "@/lib/repositories/notification-preferences";
import { NotificationPreferencesCard } from "@/components/settings/notification-preferences-card";

export const metadata = {
  title: "Notification Settings - PaySwift",
  description: "Choose which alerts you receive",
};

export default async function NotificationSettingsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const context = await getOrganizationContext(userId, orgId);
  if (!context || !context.merchant) redirect("/onboarding");

  const prefs = await getNotificationPreferences(context.organization.id);
  const canEdit = ["owner", "admin"].includes(context.membership.role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
        <p className="text-muted-foreground mt-1">
          Control what shows up in your dashboard notification bell.
        </p>
      </div>

      <NotificationPreferencesCard initial={prefs} canEdit={canEdit} />
    </div>
  );
}
