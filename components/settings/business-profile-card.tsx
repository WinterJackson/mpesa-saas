"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { updateBusinessNameAction } from "@/lib/actions/profile";

interface BusinessProfileCardProps {
  initialBusinessName: string;
  canEdit: boolean;
}

export function BusinessProfileCard({ initialBusinessName, canEdit }: BusinessProfileCardProps) {
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [saved, setSaved] = useState(initialBusinessName);
  const [isPending, startTransition] = useTransition();

  const dirty = businessName.trim() !== saved && businessName.trim().length > 0;

  function onSave() {
    startTransition(async () => {
      const result = await updateBusinessNameAction({ businessName });
      if (result.success) {
        setSaved(businessName.trim());
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
          <Building2 className="size-5" />
          Business profile
        </CardTitle>
        <CardDescription>
          Your business name appears on your dashboard, receipts and hosted checkout pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            disabled={!canEdit || isPending}
            maxLength={100}
            placeholder="e.g. Mama Mboga Supplies"
          />
          {!canEdit && (
            <p className="text-xs text-muted-foreground">
              Only owners and admins can change the business name.
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={!dirty || isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
