'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';

export function PayoutApprovalCard({ 
  initialThresholdKes,
  currentRole
}: { 
  initialThresholdKes: number | null;
  currentRole: string;
}) {
  const [threshold, setThreshold] = useState(initialThresholdKes?.toString() || '');
  const [saving, setSaving] = useState(false);

  const canEdit = ['owner', 'admin'].includes(currentRole);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/merchant/settings/payout-approval', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholdKes: threshold === '' ? null : Number(threshold) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Payout approval threshold updated');
      } else {
        toast.error(data.error || 'Failed to update threshold');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-5 text-muted-foreground" />
          Payout Approvals
        </CardTitle>
        <CardDescription>
          Require a second operator to approve any B2C payout above a certain amount.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid gap-2 flex-1">
            <Label htmlFor="threshold">Approval Threshold (KES)</Label>
            <Input 
              id="threshold" 
              type="number" 
              placeholder="e.g. 10000 (leave empty to disable)"
              value={threshold} 
              onChange={(e) => setThreshold(e.target.value)}
              disabled={!canEdit || saving}
            />
            <p className="text-xs text-muted-foreground">
              Any payout larger than this amount will be held in &quot;Pending Approval&quot; state until a different team member approves it. Leave blank to disable approvals entirely.
            </p>
          </div>
          <Button onClick={handleSave} disabled={!canEdit || saving || threshold === initialThresholdKes?.toString()}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
        {!canEdit && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-500 font-medium">
            Only Organization Owners and Admins can change this setting.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
