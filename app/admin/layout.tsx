import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { reconcileAdminFromInvite } from '@/lib/admin-invite-sync';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/dashboard/user-menu';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import type { AdminRole } from '@/lib/admin-rbac';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  let adminAuth = await requireAdmin(userId);

  // Invited-by-email admin whose account exists but isn't bound yet: match their
  // Clerk-verified email against a pending invite and promote them on this first
  // /admin visit, before falling back to the dashboard.
  if (!adminAuth.allowed) {
    const user = await currentUser();
    const email =
      user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress ??
      null;
    if (await reconcileAdminFromInvite(userId, email)) {
      adminAuth = await requireAdmin(userId);
    }
  }

  if (!adminAuth.allowed) {
    redirect('/dashboard');
  }

  const roleName = adminAuth.admin.role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <div className="flex h-screen overflow-hidden bg-dashboard bg-cover bg-center bg-no-repeat relative z-0">
      {/* Sidebar (Desktop) / Bottom Nav (Mobile) */}
      <AdminSidebar role={adminAuth.admin.role as AdminRole} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <div className="w-full shrink-0 pt-floating-header pl-[15px] md:pl-[30px] pr-0 pb-4">
          <header className="w-full rounded-l-[40px] rounded-r-none bg-background dark:bg-card text-foreground backdrop-blur-md shadow-floating-header">
            <div className="flex h-20 w-full items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-4 min-w-0 border-b-2 border-r-2 border-sidebar pr-4 pb-1 rounded-br-xl">
                <h1 className="text-sm md:text-lg font-semibold tracking-tight text-foreground truncate max-w-[200px] md:max-w-[320px]">
                  {roleName}
                </h1>
              </div>
              <div className="flex items-center gap-4 ml-auto">
                <NotificationBell />
                <ThemeToggle />
                <UserMenu />
              </div>
            </div>
          </header>
        </div>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl 2xl:max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
