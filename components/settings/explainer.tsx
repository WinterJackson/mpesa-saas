"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small, accessible "What's this?" disclosure. Wrap any jargon-heavy control
 * with a plain-language explanation a non-technical store owner can understand.
 * Collapsed by default so it never adds clutter for users who don't need it.
 */
export function Explainer({
  label = "What is this?",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
      >
        <HelpCircle className="size-3.5" />
        {label}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
