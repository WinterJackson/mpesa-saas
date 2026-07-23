'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function GoLiveButton({ organizationId, disabled, disabledReason }: { organizationId: string; disabled: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function approve() {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/go-live`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Approval failed');
      toast.success('Organization approved for live mode.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" onClick={approve} disabled={disabled || isSubmitting}>
        {isSubmitting ? 'Approving…' : 'Approve go-live'}
      </Button>
      {disabled && disabledReason && <span className="text-xs text-muted-foreground">{disabledReason}</span>}
    </div>
  );
}
