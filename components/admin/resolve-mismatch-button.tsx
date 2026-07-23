'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ResolveMismatchButton({ mismatchId }: { mismatchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'resolved' | 'ignored' | null>(null);

  async function resolve(status: 'resolved' | 'ignored') {
    setBusy(status);
    try {
      const response = await fetch(`/api/admin/reconciliation/${mismatchId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      toast.success(`Marked ${status}.`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button type="button" size="xs" onClick={() => resolve('resolved')} disabled={busy !== null}>
        {busy === 'resolved' ? '…' : 'Resolve'}
      </Button>
      <Button type="button" size="xs" variant="outline" onClick={() => resolve('ignored')} disabled={busy !== null}>
        {busy === 'ignored' ? '…' : 'Ignore'}
      </Button>
    </div>
  );
}
