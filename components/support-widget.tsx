"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MessageCircle, X, Mail, BookOpen, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_EMAIL, whatsappUrl } from "@/lib/support";

/**
 * Floating support launcher, bottom-right on every page. A tap opens a small
 * panel offering the primary channel (WhatsApp) plus email, docs, and status.
 * WhatsApp deep-links to wa.me with a pre-filled message so the merchant lands
 * in a chat with one tap on both mobile and desktop.
 */
export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      /* Sits above the mobile dashboard bottom-nav (h-20 + safe area, z-50);
         drops to a normal corner offset from sm: up where there is no bottom nav. */
      className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 sm:bottom-5 sm:right-5 z-40 flex flex-col items-end gap-3 print:hidden"
    >
      {open && (
        <div className="w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-border bg-background shadow-floating-header">
          <div className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-sm font-semibold">Need a hand?</p>
              <p className="text-xs opacity-90">We usually reply within minutes.</p>
            </div>
            <button
              type="button"
              aria-label="Close support"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 transition-colors hover:bg-white/15"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col p-2">
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C7E] dark:text-white">
                <MessageCircle className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Chat on WhatsApp</span>
                <span className="text-xs text-muted-foreground">{SUPPORT_WHATSAPP_DISPLAY}</span>
              </span>
            </a>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-white">
                <Mail className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Email support</span>
                <span className="text-xs text-muted-foreground">{SUPPORT_EMAIL}</span>
              </span>
            </a>

            <Link
              href="/docs"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-white">
                <BookOpen className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Read the docs</span>
                <span className="text-xs text-muted-foreground">Guides &amp; API reference</span>
              </span>
            </Link>

            <Link
              href="/status"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-white">
                <Activity className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">System status</span>
                <span className="text-xs text-muted-foreground">Live platform health</span>
              </span>
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? "Close support" : "Get support"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex size-14 items-center justify-center rounded-full text-white shadow-floating-header transition-all hover:scale-105 active:scale-95",
          open ? "bg-primary" : "bg-[#25D366]"
        )}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-7" />}
      </button>
    </div>
  );
}
