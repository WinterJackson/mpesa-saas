"use client";

import { UserProfile } from "@clerk/nextjs";
import { useTheme } from "@wrksz/themes/client";

/**
 * Clerk's embedded account manager, themed to match PaySwift. This is the ONE
 * place personal identity is edited (name, email, phone, password, two-factor,
 * active sessions, connected accounts) — Clerk owns auth/identity across the
 * whole platform, so both the merchant and admin profile pages render this.
 *
 * The colour variables are driven off the resolved light/dark theme so Clerk's
 * surfaces use the SAME `--card`/`--background` tokens as the rest of the app —
 * in dark mode the cards are the platform's card-black, not Clerk's default
 * white. Values mirror the tokens in app/globals.css.
 *
 * `routing="hash"` keeps every sub-panel on the same URL, so it drops into any
 * page without needing a catch-all route segment.
 */
export function ClerkProfile() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <UserProfile
      routing="hash"
      appearance={{
        variables: {
          colorPrimary: "#132a13",
          colorPrimaryForeground: "oklch(0.985 0 0)",
          // Match the app's --card / --background / --foreground tokens (globals.css)
          // so Clerk's surfaces are card-black in dark mode, white in light mode.
          colorBackground: isDark ? "oklch(0.205 0 0)" : "oklch(1 0 0)",
          colorForeground: isDark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)",
          colorMutedForeground: isDark ? "oklch(0.708 0 0)" : "oklch(0.556 0 0)",
          colorInput: isDark ? "oklch(0.145 0 0)" : "oklch(1 0 0)",
          colorInputForeground: isDark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)",
          borderRadius: "0.625rem",
        },
        elements: {
          // Force full width so it lines up exactly with the sibling cards.
          rootBox: "!w-full",
          cardBox: "!w-full !max-w-none shadow-none border border-border rounded-xl",
          card: "bg-card",
          navbar: "border-border",
          scrollBox: "bg-card",
          pageScrollBox: "bg-card",
          formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
        },
      }}
    />
  );
}
