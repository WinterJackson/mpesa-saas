'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ImpersonateButton({ organizationId }: { organizationId: string }) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/impersonate`, { method: 'POST' });
      const data = await response.json();
      // A 501 here is expected until Clerk User Impersonation is configured —
      // the audit log entry is still written server-side either way.
      toast.info(data.error || 'Impersonation recorded.');
    } catch {
      toast.error('Failed to record impersonation attempt.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Recording...' : 'Impersonate (support)'}
    </Button>
  );
}
