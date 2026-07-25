"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A titled, collapsible group of settings cards. Used to tuck away optional or
 * advanced sections (e.g. developer tools) behind a single header so the page
 * stays approachable for non-technical users while power users can expand it.
 */
export function CollapsibleSection({
  title,
  description,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  /** A rendered icon element (e.g. <Code2 className="size-5" />). A React
   *  element serializes across the server→client boundary; a component
   *  reference does not, so callers pass the element, not the component. */
  icon?: React.ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        {icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">{title}</span>
            {badge && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {badge}
              </span>
            )}
          </span>
          {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && <div className="mt-4 grid gap-6">{children}</div>}
    </section>
  );
}
