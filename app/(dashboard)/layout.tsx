import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getOrganizationContext } from "@/lib/repositories/organizations";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookOpen } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Ensure the org/merchant exists (if they bypassed onboarding)
  const context = await getOrganizationContext(userId, orgId);

  if (!context) {
    redirect("/onboarding");
  }

  const businessName = context.merchant?.businessName ?? context.organization.businessName;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (Desktop) / Bottom Nav (Mobile) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <div className="w-full shrink-0 pt-floating-header px-floating-header pb-4">
          <header className="w-full rounded-floating-header bg-background/80 backdrop-blur-md shadow-floating-header">
            <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-4 min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-foreground truncate max-w-[200px] md:max-w-[320px]">
                  {businessName}
                </h1>
              </div>
              <div className="flex items-center gap-4 ml-auto">
                <ThemeToggle />
                <UserButton>
                  <UserButton.MenuItems>
                    <UserButton.Link
                      label="Documentation"
                      labelIcon={<BookOpen className="size-4" />}
                      href="https://github.com/WinterJackson/mpesa-saas#readme"
                    />
                  </UserButton.MenuItems>
                </UserButton>
              </div>
            </div>
          </header>
        </div>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
