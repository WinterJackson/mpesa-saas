'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

interface AdminRow {
  id: string;
  clerkUserId: string;
  role: string;
  createdAt: string;
}

export function AdminManagement({ initialAdmins }: { initialAdmins: AdminRow[] }) {
  const router = useRouter();
  const [clerkUserId, setClerkUserId] = useState('');
  const [role, setRole] = useState<'support' | 'superadmin'>('support');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkUserId.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkUserId: clerkUserId.trim(), role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add admin');

      toast.success('Admin added.');
      setClerkUserId('');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add admin');
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

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="clerkUserId">Clerk User ID</Label>
          <Input id="clerkUserId" placeholder="user_..." value={clerkUserId} onChange={(e) => setClerkUserId(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={role === 'support' ? 'default' : 'outline'} onClick={() => setRole('support')}>Support</Button>
          <Button type="button" size="sm" variant={role === 'superadmin' ? 'default' : 'outline'} onClick={() => setRole('superadmin')}>Superadmin</Button>
        </div>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add admin'}</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clerk User ID</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Added</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialAdmins.map((admin) => (
            <TableRow key={admin.id}>
              <TableCell className="font-mono text-xs">{admin.clerkUserId}</TableCell>
              <TableCell className="capitalize">{admin.role}</TableCell>
              <TableCell>{new Date(admin.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <Button type="button" size="sm" variant="destructive" onClick={() => handleRemove(admin.id)} disabled={removingId === admin.id}>
                  {removingId === admin.id ? 'Removing...' : 'Remove'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
