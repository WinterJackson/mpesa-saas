'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function KycReviewActions({ documentId, organizationId }: { documentId: string; organizationId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState<'approved' | 'rejected' | null>(null);

  async function review(reviewStatus: 'approved' | 'rejected') {
    setIsSubmitting(reviewStatus);
    try {
      const response = await fetch(`/api/admin/kyc/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, reviewStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update review status');

      toast.success(`Document ${reviewStatus}.`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update review status');
    } finally {
      setIsSubmitting(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" onClick={() => review('approved')} disabled={isSubmitting !== null}>
        {isSubmitting === 'approved' ? 'Approving...' : 'Approve'}
      </Button>
      <Button type="button" size="sm" variant="destructive" onClick={() => review('rejected')} disabled={isSubmitting !== null}>
        {isSubmitting === 'rejected' ? 'Rejecting...' : 'Reject'}
      </Button>
    </div>
  );
}
