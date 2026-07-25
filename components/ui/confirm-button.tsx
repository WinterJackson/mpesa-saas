'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ButtonVariant = 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost';
type ButtonSize = 'default' | 'sm' | 'xs' | 'lg' | 'icon';

/**
 * A button that asks for confirmation in a branded dialog before running a
 * destructive action — so an accidental tap never removes a teammate or turns
 * off a live payment link. Keeps the UX seamless (no jarring browser prompt).
 */
export function ConfirmButton({
  children,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  size = 'xs',
  disabled,
  className,
}: {
  children: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={disabled} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button type="button" variant={variant === 'outline' ? 'default' : variant} onClick={handleConfirm} disabled={pending}>
              {pending ? 'Working…' : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
