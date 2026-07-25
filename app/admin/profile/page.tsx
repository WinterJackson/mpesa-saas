import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { ClerkProfile } from "@/components/account/clerk-profile";
import { SupportPanel } from "@/components/support/support-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Account — PaySwift Admin",
  description: "Manage your admin profile and security",
};

export default async function AdminProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const adminAuth = await requireAdmin(userId);
  if (!adminAuth.allowed) redirect("/dashboard");

  const user = await currentUser();
  const email =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    "—";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your personal profile, security and admin access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-5" />
            Admin access
          </CardTitle>
          <CardDescription>Your platform-admin role and sign-in email.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <Badge className="mt-1 capitalize">{adminAuth.admin.role.replace(/_/g, " ")}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="mt-1 font-medium">{email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="secondary" className="mt-1 capitalize">{adminAuth.admin.status}</Badge>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Personal profile &amp; security</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Your name, email, password and two-factor authentication are managed here.
        </p>
        <ClerkProfile />
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">Support</h2>
        <SupportPanel context="the PaySwift admin console" />
      </div>
    </div>
  );
}
