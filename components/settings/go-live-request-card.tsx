'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket } from 'lucide-react';
import { toast } from 'sonner';

interface GoLiveRequestCardProps {
  kycApproved: boolean;
  hasLiveCredentials: boolean;
  liveRequested: boolean;
  liveApproved: boolean;
}

export function GoLiveRequestCard({ kycApproved, hasLiveCredentials, liveRequested, liveApproved }: GoLiveRequestCardProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const eligible = kycApproved && hasLiveCredentials && !liveApproved;

  async function request() {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/merchant/go-live/request', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      toast.success('Go-live requested — our team will review and approve it.');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Rocket className="size-5" />
          Go Live
        </CardTitle>
        <CardDescription>
          Live mode requires KYC approval, your own live Daraja credentials, and a final review by our
          team. Once approved you can switch to live mode from the Environment card.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        {liveApproved ? (
          <Badge>Approved for live</Badge>
        ) : liveRequested ? (
          <Badge variant="secondary">Requested — under review</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">
            {!kycApproved ? 'KYC must be approved first.' : !hasLiveCredentials ? 'Add your live Daraja credentials first.' : 'Ready to request.'}
          </span>
        )}
        {!liveApproved && (
          <Button type="button" size="sm" onClick={request} disabled={!eligible || isSubmitting}>
            {isSubmitting ? 'Requesting…' : liveRequested ? 'Re-request' : 'Request go-live'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
