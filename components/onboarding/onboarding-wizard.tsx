'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['Business Info', 'KYC Documents', 'Payment Setup', 'Webhook', 'Review'] as const;

const KYC_DOC_TYPES: { type: string; label: string }[] = [
  { type: 'id', label: 'National ID / Passport' },
  { type: 'business_registration', label: 'Business Registration Certificate' },
  { type: 'kra_pin', label: 'KRA PIN Certificate' },
];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i < step ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : i === step ? (
            <Circle className="size-4 text-primary fill-primary/20" />
          ) : (
            <Circle className="size-4 text-muted-foreground/40" />
          )}
          {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 0: Business Info
  const [businessName, setBusinessName] = useState('');
  const [isSubmittingBusiness, setIsSubmittingBusiness] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);

  // Step 1: KYC
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadedTypes, setUploadedTypes] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Step 2: Payment setup
  const [useOwnCredentials, setUseOwnCredentials] = useState(false);
  const [credMode, setCredMode] = useState<'sandbox' | 'live'>('sandbox');
  const [creds, setCreds] = useState({ consumerKey: '', consumerSecret: '', shortcode: '', passkey: '', callbackUrl: '' });
  const [isSavingCreds, setIsSavingCreds] = useState(false);

  // Step 3: Webhook
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  async function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusinessError(null);

    const trimmed = businessName.trim();
    if (trimmed.length < 2) {
      setBusinessError('Business name must be at least 2 characters long.');
      return;
    }

    setIsSubmittingBusiness(true);
    try {
      const response = await fetch('/api/merchant/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to set up your account');

      toast.success('Organization created — sandbox payments are ready to use.');
      setStep(1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setBusinessError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingBusiness(false);
    }
  }

  async function handleKycUpload(type: string, file: File) {
    setUploadingType(type);
    try {
      const formData = new FormData();
      formData.set('type', type);
      formData.set('file', file);

      const response = await fetch('/api/merchant/onboarding/kyc', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');

      setUploadedTypes((prev) => new Set(prev).add(type));
      toast.success(`${type.replace(/_/g, ' ')} uploaded — pending review.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingType(null);
    }
  }

  async function handleSaveCredentials() {
    setIsSavingCreds(true);
    try {
      const response = await fetch('/api/merchant/onboarding/payment-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: credMode, ...creds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save credentials');

      toast.success(`${credMode === 'live' ? 'Live' : 'Sandbox'} credentials saved and validated with Safaricom.`);
      setStep(3);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setIsSavingCreds(false);
    }
  }

  async function handleSaveWebhook() {
    setIsSavingWebhook(true);
    try {
      if (webhookUrl.trim()) {
        const response = await fetch('/api/merchant/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save webhook URL');
      }
      setStep(4);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save webhook URL');
    } finally {
      setIsSavingWebhook(false);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <StepIndicator step={step} />

      {step === 0 && (
        <Card className="shadow-lg border-border">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome to PaySwift</CardTitle>
            <CardDescription>Enter your business details to create your organization.</CardDescription>
          </CardHeader>
          <form onSubmit={handleBusinessSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="e.g. Acme Corporation"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={isSubmittingBusiness}
                  required
                  autoFocus
                />
                {businessError && (
                  <p className="text-sm font-medium text-destructive mt-1" role="alert">{businessError}</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full font-semibold" disabled={isSubmittingBusiness}>
                {isSubmittingBusiness ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up...</>
                ) : 'Continue'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === 1 && (
        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle>Verify your business</CardTitle>
            <CardDescription>
              Upload the documents below for manual review. You can also do this later from Settings —
              it doesn&apos;t block using sandbox payments today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {KYC_DOC_TYPES.map(({ type, label }) => (
              <div key={type} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  {uploadedTypes.has(type) ? (
                    <CheckCircle2 className="size-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-sm">{label}</span>
                </div>
                <input
                  ref={(el) => { fileInputRefs.current[type] = el; }}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleKycUpload(type, file);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadingType === type}
                  onClick={() => fileInputRefs.current[type]?.click()}
                >
                  {uploadingType === type ? <Loader2 className="size-4 animate-spin" /> : uploadedTypes.has(type) ? 'Replace' : 'Upload'}
                </Button>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button type="button" className="w-full font-semibold" onClick={() => setStep(2)}>
              Continue
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle>Payment setup</CardTitle>
            <CardDescription>
              Your organization already has a shared sandbox connection ready to use — you can send a test
              M-Pesa prompt today. Optionally, connect your own Safaricom credentials below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!useOwnCredentials ? (
              <Button type="button" variant="outline" onClick={() => setUseOwnCredentials(true)}>
                Use my own Daraja credentials
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={credMode === 'sandbox' ? 'default' : 'outline'} onClick={() => setCredMode('sandbox')}>Sandbox</Button>
                  <Button type="button" size="sm" variant={credMode === 'live' ? 'default' : 'outline'} onClick={() => setCredMode('live')}>Live</Button>
                </div>
                {(['consumerKey', 'consumerSecret', 'shortcode', 'passkey', 'callbackUrl'] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={field}>{field}</Label>
                    <Input
                      id={field}
                      value={creds[field]}
                      onChange={(e) => setCreds((c) => ({ ...c, [field]: e.target.value }))}
                      type={field.toLowerCase().includes('secret') || field === 'passkey' ? 'password' : 'text'}
                    />
                  </div>
                ))}
                <Button type="button" className="w-full" onClick={handleSaveCredentials} disabled={isSavingCreds}>
                  {isSavingCreds ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating with Safaricom...</> : 'Save & validate'}
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="button" className="w-full font-semibold" variant={useOwnCredentials ? 'outline' : 'default'} onClick={() => setStep(3)}>
              {useOwnCredentials ? 'Skip for now' : 'Continue with pooled sandbox'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle>Webhook configuration</CardTitle>
            <CardDescription>Where should PaySwift send payment status updates? You can change this later in Settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL (optional)</Label>
            <Input
              id="webhookUrl"
              placeholder="https://yourapp.com/webhooks/payswift"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </CardContent>
          <CardFooter>
            <Button type="button" className="w-full font-semibold" onClick={handleSaveWebhook} disabled={isSavingWebhook}>
              {isSavingWebhook ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Continue'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && (
        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle>You&apos;re all set</CardTitle>
            <CardDescription>
              Your organization is live in sandbox mode. Going live with real M-Pesa payments requires
              KYC approval and is completed from Settings once your documents are reviewed.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button type="button" className="w-full font-semibold" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
