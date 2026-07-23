'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function MarkInvoicePaidButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/mark-paid`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to mark invoice paid');

      toast.success('Invoice marked paid.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark invoice paid');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button type="button" size="sm" onClick={handleClick} disabled={isSubmitting}>
      {isSubmitting ? 'Marking...' : 'Mark paid'}
    </Button>
  );
}
