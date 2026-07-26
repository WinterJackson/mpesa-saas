'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function RefreshBalanceButton({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleRefresh() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/account-balance`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error('Failed to trigger refresh', {
          description: data.error || 'Unknown error',
        });
      } else {
        toast.success('Refresh queued', {
          description: 'A balance query has been dispatched. Results will appear shortly.',
        });
        router.refresh();
      }
    } catch {
      toast.error('Network error', { description: 'Could not connect to the server.' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  );
}
