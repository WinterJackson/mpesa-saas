import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrganizationContext, listMemberships } from '@/lib/repositories/organizations';
import { TeamManagement } from '@/components/team/team-management';

export const metadata = {
  title: 'Team - PaySwift',
  description: 'Invite teammates and manage their access.',
};

export default async function TeamPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  const context = await getOrganizationContext(userId, orgId);
  if (!context) redirect('/onboarding');

  const memberships = await listMemberships(context.organization.id);

  const client = await clerkClient();
  const clerkUsers = memberships.length > 0
    ? (await client.users.getUserList({ userId: memberships.map((m) => m.clerkUserId) })).data
    : [];

  const members = memberships.map((m) => {
    const user = clerkUsers.find((u) => u.id === m.clerkUserId);
    return {
      clerkUserId: m.clerkUserId,
      role: m.role,
      email: user?.emailAddresses?.[0]?.emailAddress ?? m.clerkUserId,
      isCurrentUser: m.clerkUserId === userId,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Invite teammates and manage their access.</p>
      </div>
      <TeamManagement members={members} currentRole={context.membership.role} />
    </div>
  );
}
