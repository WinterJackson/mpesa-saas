'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { payNowAction } from '@/lib/actions/billing';

export function PayNowButton({
  disabled,
  variant = 'default',
  label = 'Pay now',
}: {
  disabled?: boolean;
  variant?: 'default' | 'outline';
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await payNowAction();
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <Button onClick={onClick} disabled={disabled || pending} variant={variant}>
      {pending ? 'Starting…' : label}
    </Button>
  );
}
