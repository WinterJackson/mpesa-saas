'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface DarajaCredentialsCardProps {
  sandboxShortcode: string | null;
  isPooledSandbox: boolean;
  liveShortcode: string | null;
  hasLiveCredentials: boolean;
}

const EMPTY_FORM = { consumerKey: '', consumerSecret: '', shortcode: '', passkey: '', callbackUrl: '' };

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
          Payment Credentials
        </CardTitle>
        <CardDescription>
          Your organization&apos;s own Safaricom Daraja credentials. Live credentials are always yours alone — never shared or pooled across organizations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
          <div>
            <p className="font-medium">Sandbox</p>
            <p className="text-muted-foreground">
              {isPooledSandbox ? 'Using PaySwift\'s shared sandbox' : `Shortcode: ${sandboxShortcode ?? '—'}`}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditingMode(editingMode === 'sandbox' ? null : 'sandbox')}>
            {isPooledSandbox ? 'Use my own' : 'Rotate'}
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
          <div>
            <p className="font-medium">Live</p>
            <p className="text-muted-foreground">{hasLiveCredentials ? `Shortcode: ${liveShortcode}` : 'Not configured'}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditingMode(editingMode === 'live' ? null : 'live')}>
            {hasLiveCredentials ? 'Rotate' : 'Add live credentials'}
          </Button>
        </div>

        {editingMode && (
          <div className="space-y-3 rounded-md border p-3">
            {(['consumerKey', 'consumerSecret', 'shortcode', 'passkey', 'callbackUrl'] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`daraja-${field}`}>{field}</Label>
                <Input
                  id={`daraja-${field}`}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  type={field.toLowerCase().includes('secret') || field === 'passkey' ? 'password' : 'text'}
                />
              </div>
            ))}
            <Button type="button" className="w-full" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Validating with Safaricom...' : 'Save & validate'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
