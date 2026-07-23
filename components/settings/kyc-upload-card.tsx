'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const KYC_DOC_TYPES: { type: string; label: string }[] = [
  { type: 'id', label: 'National ID / Passport' },
  { type: 'business_registration', label: 'Business Registration Certificate' },
  { type: 'kra_pin', label: 'KRA PIN Certificate' },
];

interface DocumentRow {
  type: string;
  reviewStatus: string;
}

export function KycUploadCard({ documents }: { documents: DocumentRow[] }) {
  const router = useRouter();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(type: string, file: File) {
    setUploadingType(type);
    try {
      const formData = new FormData();
      formData.set('type', type);
      formData.set('file', file);

      const response = await fetch('/api/merchant/onboarding/kyc', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');

      toast.success(`${type.replace(/_/g, ' ')} uploaded — pending review.`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <div className="space-y-3">
      {KYC_DOC_TYPES.map(({ type, label }) => {
        const existing = documents.find((d) => d.type === type);
        return (
          <div key={type} className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">{label}</span>
              {existing && (
                <Badge variant={existing.reviewStatus === 'approved' ? 'default' : existing.reviewStatus === 'rejected' ? 'destructive' : 'secondary'}>
                  {existing.reviewStatus}
                </Badge>
              )}
            </div>
            <input
              ref={(el) => { fileInputRefs.current[type] = el; }}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(type, file);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadingType === type || existing?.reviewStatus === 'approved'}
              onClick={() => fileInputRefs.current[type]?.click()}
            >
              {uploadingType === type ? 'Uploading...' : existing ? 'Replace' : 'Upload'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
