'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { toast } from 'sonner';

interface Member {
  clerkUserId: string;
  role: string;
  email: string;
  isCurrentUser: boolean;
}

const ASSIGNABLE_ROLES = ['admin', 'developer', 'finance'] as const;

// Plain-language explanation of what each role can do — shown so a non-technical
// owner knows exactly what access they're granting.
const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full access, including billing and closing the account.',
  admin: 'Manage the team, settings, payment links and payments — everything except closing the account.',
  developer: 'Access API keys, webhooks and payment links to build the integration. No billing access.',
  finance: 'View payments and manage billing and payouts. Cannot change technical settings.',
};

export function TeamManagement({ members, currentRole }: { members: Member[]; currentRole: string }) {
  const router = useRouter();
  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<(typeof ASSIGNABLE_ROLES)[number]>('developer');
  const [isInviting, setIsInviting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsInviting(true);
    try {
      const response = await fetch('/api/merchant/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role: inviteRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send invite');

      toast.success(`Invitation sent to ${email.trim()}.`);
      setEmail('');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(clerkUserId: string, role: string) {
    setBusyUserId(clerkUserId);
    try {
      const response = await fetch(`/api/merchant/team/${clerkUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update role');

      toast.success('Role updated.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRemove(clerkUserId: string) {
    setBusyUserId(clerkUserId);
    try {
      const response = await fetch(`/api/merchant/team/${clerkUserId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove member');

      toast.success('Member removed.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a teammate</CardTitle>
            <CardDescription>They&apos;ll receive an email invitation from Clerk to join this organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 flex-1 min-w-48">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex gap-2">
                {ASSIGNABLE_ROLES.map((role) => (
                  <Button key={role} type="button" size="sm" variant={inviteRole === role ? 'default' : 'outline'} onClick={() => setInviteRole(role)} className="capitalize">
                    {role}
                  </Button>
                ))}
              </div>
              <Button type="submit" disabled={isInviting}>{isInviting ? 'Sending...' : 'Send invite'}</Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium capitalize text-foreground">{inviteRole}:</span>{' '}
              {ROLE_DESCRIPTIONS[inviteRole]}
            </p>
          </CardContent>
        </Card>
      )}

      {/* What each role can do — plain-language legend for non-technical owners. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What each role can do</CardTitle>
          <CardDescription>Give people only the access they need.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(['owner', 'admin', 'finance', 'developer'] as const).map((role) => (
            <div key={role} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium capitalize">{role}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            {canManage && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.clerkUserId}>
              <TableCell>
                {member.email}
                {member.isCurrentUser && <Badge variant="outline" className="ml-2">You</Badge>}
              </TableCell>
              <TableCell className="capitalize">{member.role}</TableCell>
              {canManage && (
                <TableCell>
                  {member.role === 'owner' ? (
                    <span className="text-xs text-muted-foreground">Owner</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ASSIGNABLE_ROLES.filter((r) => r !== member.role).map((role) => (
                        <Button
                          key={role}
                          type="button"
                          size="xs"
                          variant="outline"
                          className="capitalize"
                          disabled={busyUserId === member.clerkUserId}
                          onClick={() => handleRoleChange(member.clerkUserId, role)}
                        >
                          Make {role}
                        </Button>
                      ))}
                      <ConfirmButton
                        size="xs"
                        variant="destructive"
                        disabled={busyUserId === member.clerkUserId}
                        onConfirm={() => handleRemove(member.clerkUserId)}
                        title="Remove this teammate?"
                        description={`${member.email} will immediately lose access to this account. You can invite them again later.`}
                        confirmLabel="Remove teammate"
                      >
                        Remove
                      </ConfirmButton>
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
