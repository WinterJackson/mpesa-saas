'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const ADMIN_ROLES = [
  { value: 'support', label: 'Support' },
  { value: 'kyc_reviewer', label: 'KYC Reviewer' },
  { value: 'finance', label: 'Finance' },
  { value: 'ops', label: 'Operations' },
  { value: 'superadmin', label: 'Superadmin' },
] as const;

type AdminRole = (typeof ADMIN_ROLES)[number]['value'];

function roleLabel(role: string): string {
  return ADMIN_ROLES.find((r) => r.value === role)?.label ?? role;
}

interface AdminRow {
  id: string;
  clerkUserId: string;
  role: string;
  email: string | null;
  status?: string;
  createdAt: string;
}

interface InviteRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export function AdminManagement({
  initialAdmins,
  initialInvites,
}: {
  initialAdmins: AdminRow[];
  initialInvites: InviteRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('support');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/admins/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send invite');

      toast.success(
        data.status === 'granted'
          ? 'Admin access granted — they already have a PaySwift account.'
          : 'Invite sent — they’ll get admin access once they sign up with this email.'
      );
      setEmail('');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const response = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove admin');

      toast.success('Admin removed.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove admin');
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      const response = await fetch(`/api/admin/admins/invite/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to revoke invite');

      toast.success('Invite revoked.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invite');
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Invite by email */}
      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="invite-email">Invite by email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@payswift.co.ke"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-72"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {ADMIN_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send invite'}</Button>
      </form>
      <p className="-mt-4 text-xs text-muted-foreground">
        If they already have a PaySwift account, access is granted immediately. Otherwise they’re
        emailed a sign-up link and gain access automatically once they join with that email.
      </p>

      {/* Pending invites */}
      {initialInvites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Pending invites</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialInvites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{roleLabel(inv.role)}</TableCell>
                  <TableCell>{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevoke(inv.id)}
                      disabled={revokingId === inv.id}
                    >
                      {revokingId === inv.id ? 'Revoking…' : 'Revoke'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Active admins */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Admins</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialAdmins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell>
                  {admin.email ?? <span className="font-mono text-xs text-muted-foreground">{admin.clerkUserId}</span>}
                  {admin.status === 'disabled' && (
                    <Badge variant="secondary" className="ml-2 text-xs">disabled</Badge>
                  )}
                </TableCell>
                <TableCell>{roleLabel(admin.role)}</TableCell>
                <TableCell>{new Date(admin.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="destructive" onClick={() => handleRemove(admin.id)} disabled={removingId === admin.id}>
                    {removingId === admin.id ? 'Removing…' : 'Remove'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
