'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveBillingDetailsAction } from '@/lib/actions/billing';

export function BillingSettingsForm({
  initialPhone,
  initialEmail,
  canEdit,
}: {
  initialPhone: string;
  initialEmail: string;
  canEdit: boolean;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveBillingDetailsAction({ billingMpesaPhone: phone, billingContactEmail: email });
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="billingMpesaPhone">Billing M-Pesa number</Label>
        <Input
          id="billingMpesaPhone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XX XXX XXX"
          disabled={!canEdit || pending}
          autoComplete="tel"
        />
        <p className="text-xs text-muted-foreground">
          The number we send the M-Pesa prompt to when your subscription renews. This is separate from
          your own store’s M-Pesa shortcode.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="billingContactEmail">Billing contact email (optional)</Label>
        <Input
          id="billingContactEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="finance@yourbusiness.co.ke"
          disabled={!canEdit || pending}
          autoComplete="email"
        />
        <p className="text-xs text-muted-foreground">Where invoices and payment reminders are sent.</p>
      </div>

      {canEdit ? (
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save billing details'}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only owners, admins and finance members can change billing details.
        </p>
      )}
    </form>
  );
}
