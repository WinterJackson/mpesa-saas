import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { reconcileAdminFromInvite } from '@/lib/admin-invite-sync';

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="mx-auto max-w-6xl flex items-center gap-6 px-4 py-4 text-sm">
          <span className="font-semibold">PaySwift Admin</span>
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">Overview</Link>
          <Link href="/admin/organizations" className="text-muted-foreground hover:text-foreground">Organizations</Link>
          <Link href="/admin/kyc-review" className="text-muted-foreground hover:text-foreground">KYC Review</Link>
          <Link href="/admin/billing" className="text-muted-foreground hover:text-foreground">Billing</Link>
          <Link href="/admin/reconciliation" className="text-muted-foreground hover:text-foreground">Reconciliation</Link>
          <Link href="/admin/transactions" className="text-muted-foreground hover:text-foreground">Transactions</Link>
          {adminAuth.admin.role === 'superadmin' && (
            <Link href="/admin/admins" className="text-muted-foreground hover:text-foreground">Admins</Link>
          )}
          <Link href="/admin/profile" className="ml-auto text-muted-foreground hover:text-foreground">Account</Link>
          <span className="text-xs text-muted-foreground">
            {adminAuth.admin.role}
          </span>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
    </div>
  );
}
