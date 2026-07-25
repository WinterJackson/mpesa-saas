'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Explainer } from '@/components/settings/explainer';

interface DarajaCredentialsCardProps {
  sandboxShortcode: string | null;
  isPooledSandbox: boolean;
  liveShortcode: string | null;
  hasLiveCredentials: boolean;
}

const EMPTY_FORM = { consumerKey: '', consumerSecret: '', shortcode: '', passkey: '', callbackUrl: '' };

// Human-readable labels + guidance for each Safaricom Daraja field. The API
// still receives the original camelCase keys — only the presentation changes.
const FIELD_META: {
  key: keyof typeof EMPTY_FORM;
  label: string;
  help: string;
  secret: boolean;
  placeholder?: string;
}[] = [
  {
    key: 'consumerKey',
    label: 'Consumer Key',
    help: 'From your app on Safaricom’s Daraja portal (developer.safaricom.co.ke → your app → Keys).',
    secret: false,
    placeholder: 'e.g. GjR8s9K2...',
  },
  {
    key: 'consumerSecret',
    label: 'Consumer Secret',
    help: 'Shown right next to the Consumer Key on the same Daraja screen.',
    secret: true,
  },
  {
    key: 'shortcode',
    label: 'Business shortcode (Paybill or Till)',
    help: 'Your M-Pesa Paybill or Till number issued by Safaricom.',
    secret: false,
    placeholder: 'e.g. 174379',
  },
  {
    key: 'passkey',
    label: 'Lipa na M-Pesa passkey',
    help: 'The Online passkey Safaricom issues for your shortcode after Go-Live approval.',
    secret: true,
  },
  {
    key: 'callbackUrl',
    label: 'Callback URL',
    help: 'Where Safaricom sends payment results. Use the URL PaySwift provided, or keep the suggested default.',
    secret: false,
    placeholder: 'https://...',
  },
];

export function DarajaCredentialsCard({ sandboxShortcode, isPooledSandbox, liveShortcode, hasLiveCredentials }: DarajaCredentialsCardProps) {
  const router = useRouter();
  const [editingMode, setEditingMode] = useState<'sandbox' | 'live' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!editingMode) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/merchant/onboarding/payment-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: editingMode, ...form }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save credentials');

      toast.success(`${editingMode === 'live' ? 'Live' : 'Sandbox'} credentials saved and validated.`);
      setEditingMode(null);
      setForm(EMPTY_FORM);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <KeyRound className="size-5" />
          Your M-Pesa connection
        </CardTitle>
        <CardDescription>
          The details that let PaySwift move real money into your own M-Pesa account. You get these from
          Safaricom. Your live details are always yours alone — never shared with other businesses.
        </CardDescription>
        <Explainer label="Where do these come from, and do I need them now?">
          <p>
            To accept <strong className="text-foreground">real</strong> M-Pesa payments, Safaricom gives your
            business a set of credentials (a Paybill/Till number and a few keys) through their{" "}
            <strong className="text-foreground">Daraja developer portal</strong>. Pasting them here connects
            your PaySwift account to your own M-Pesa till, so money settles directly to you.
          </p>
          <p>
            <strong className="text-foreground">Just testing?</strong> You don&apos;t need to add anything —
            we provide a shared test (sandbox) connection out of the box, so you can try the whole payment
            flow with fake money first.
          </p>
          <p>
            Not sure how to get these? Our support team can walk you through it — tap the WhatsApp button at
            the bottom of the screen.
          </p>
        </Explainer>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
          <div>
            <p className="font-medium">Sandbox <span className="font-normal text-muted-foreground">· testing, no real money</span></p>
            <p className="text-muted-foreground">
              {isPooledSandbox ? 'Ready to use — PaySwift’s shared test connection' : `Your shortcode: ${sandboxShortcode ?? '—'}`}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditingMode(editingMode === 'sandbox' ? null : 'sandbox')}>
            {isPooledSandbox ? 'Use my own' : 'Replace'}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
          <div>
            <p className="font-medium">Live <span className="font-normal text-muted-foreground">· real M-Pesa payments</span></p>
            <p className="text-muted-foreground">{hasLiveCredentials ? `Your shortcode: ${liveShortcode}` : 'Not connected yet'}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditingMode(editingMode === 'live' ? null : 'live')}>
            {hasLiveCredentials ? 'Replace' : 'Connect'}
          </Button>
        </div>

        {editingMode && (
          <div className="space-y-4 rounded-md border p-4">
            <p className="text-sm font-medium text-foreground">
              {editingMode === 'live' ? 'Enter your live M-Pesa details' : 'Enter your own sandbox details'}
            </p>
            {FIELD_META.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={`daraja-${field.key}`}>{field.label}</Label>
                <Input
                  id={`daraja-${field.key}`}
                  value={form[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                  type={field.secret ? 'password' : 'text'}
                />
                <p className="text-xs text-muted-foreground">{field.help}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              When you save, we check these directly with Safaricom before storing them — encrypted — so a
              typo is caught immediately.
            </p>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Checking with Safaricom…' : 'Save & verify'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingMode(null)} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
