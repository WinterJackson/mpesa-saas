import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { listAdminUsers, listPendingAdminInvites } from '@/lib/repositories/admin';
import { AdminManagement } from '@/components/admin/admin-management';

export const metadata = {
  title: 'Admin Users - PaySwift Admin',
};

export default async function AdminAdminsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // The layout already gates any-admin access; this page additionally
  // requires superadmin, since granting/revoking admin access is more
  // sensitive than reviewing KYC or viewing organizations.
  const adminAuth = await requireAdmin(userId, ['superadmin']);
  if (!adminAuth.allowed) {
    redirect('/admin');
  }

  const [admins, invites] = await Promise.all([listAdminUsers(), listPendingAdminInvites()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Users</h1>
        <p className="text-sm text-muted-foreground">
          Superadmin only — invite platform staff by email and manage admin access.
        </p>
      </div>
      <AdminManagement
        initialAdmins={admins.map((a) => ({
          id: a.id,
          clerkUserId: a.clerkUserId,
          role: a.role,
          email: a.email ?? null,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        }))}
        initialInvites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          expiresAt: i.expiresAt.toISOString(),
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
