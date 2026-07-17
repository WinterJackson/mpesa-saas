import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Ensure merchant exists (if they bypassed onboarding)
  const merchant = await prisma.merchant.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, businessName: true },
  });

  if (!merchant) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (Desktop) / Bottom Nav (Mobile) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-4">
            {/* On mobile, show business name in header */}
            <h1 className="md:hidden text-lg font-semibold tracking-tight text-foreground truncate max-w-[200px]">
              {merchant.businessName}
            </h1>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <ThemeToggle />
            <UserButton />
          </div>
        </header>

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
