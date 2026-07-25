"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { saveNotificationPreferencesAction } from "@/lib/actions/notification-preferences";
import type { NotificationPreferences } from "@/lib/repositories/notification-preferences";

interface NotificationPreferencesCardProps {
  initial: NotificationPreferences;
  canEdit: boolean;
}

const ROWS: { key: keyof NotificationPreferences; title: string; description: string }[] = [
  { key: "paymentAlerts", title: "Payments", description: "Successful and failed customer payments." },
  { key: "payoutAlerts", title: "Payouts & refunds", description: "Money sent out — payouts and refunds concluding." },
  { key: "billingAlerts", title: "Billing", description: "Subscription invoices, receipts and payment reminders." },
  { key: "securityAlerts", title: "Verification & security", description: "KYC decisions and go-live approvals for your account." },
  { key: "productUpdates", title: "Product updates", description: "Occasional news about new PaySwift features and tips." },
];

export function NotificationPreferencesCard({ initial, canEdit }: NotificationPreferencesCardProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial);
  const [saved, setSaved] = useState<NotificationPreferences>(initial);
  const [isPending, startTransition] = useTransition();

  const dirty = ROWS.some((r) => prefs[r.key] !== saved[r.key]);

  function toggle(key: keyof NotificationPreferences, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveNotificationPreferencesAction(prefs);
      if (result.success) {
        setSaved(prefs);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Bell className="size-5" />
          Notification preferences
        </CardTitle>
        <CardDescription>
          Choose which alerts appear in your dashboard notification bell. Critical account-security and
          receipt emails are always sent, regardless of these settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{row.title}</p>
              <p className="text-xs text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              checked={prefs[row.key]}
              onCheckedChange={(v) => toggle(row.key, v)}
              disabled={!canEdit || isPending}
              aria-label={row.title}
            />
          </div>
        ))}

        {!canEdit ? (
          <p className="pt-2 text-xs text-muted-foreground">
            Only owners and admins can change notification preferences for the organization.
          </p>
        ) : (
          <div className="flex justify-end pt-4">
            <Button onClick={onSave} disabled={!dirty || isPending}>
              {isPending ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
