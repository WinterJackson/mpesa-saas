"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "payswift_cookie_consent";
const CONSENT_VERSION = "1";

type ConsentValue = "all" | "essential";

/**
 * Persists the visitor's cookie choice in localStorage (client-only, no server
 * round-trip). We only ever set strictly-necessary cookies today (Clerk auth,
 * the view-env preference, this consent flag), so "Reject" and "Accept" behave
 * identically for now — but recording an explicit, versioned choice is the
 * Kenya DPA-aligned pattern and the hook is ready for analytics later.
 */
function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: string; choice?: ConsentValue };
    if (parsed.v !== CONSENT_VERSION) return null;
    return parsed.choice ?? null;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Read the persisted choice from localStorage once on mount (an external
    // store React can't see during SSR) and reveal the banner only if the
    // visitor hasn't decided yet — this avoids a hydration flash. Mirrors the
    // notification-bell's fetch-on-mount pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (readConsent() === null) setVisible(true);
  }, []);

  function decide(choice: ConsentValue) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: CONSENT_VERSION, choice, at: new Date().toISOString() })
      );
    } catch {
      /* private-mode / storage-disabled: just close the banner */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-4 sm:bottom-5 sm:left-5 z-40 w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border border-border bg-background p-5 shadow-floating-header print:hidden"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Cookie className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">We value your privacy</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            We use strictly necessary cookies to keep you signed in and remember your preferences.
            With your consent we may also use optional cookies to improve PaySwift. See our{" "}
            <Link href="/legal/cookies" className="font-medium text-primary hover:underline">
              Cookie Policy
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button size="sm" className="flex-1" onClick={() => decide("all")}>
          Accept all
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => decide("essential")}>
          Essential only
        </Button>
      </div>
    </div>
  );
}
