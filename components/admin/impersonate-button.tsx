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
      if (response.ok && data.ticketUrl) {
        toast.success('Starting a view-as session…');
        // Hand off to Clerk's ticket sign-in, establishing a session AS the
        // merchant owner (with an actor claim identifying you).
        window.location.href = data.ticketUrl;
        return;
      }
      toast.error(data.error || 'Could not start impersonation.');
    } catch {
      toast.error('Failed to start impersonation.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Starting…' : 'View as merchant'}
    </Button>
  );
}
