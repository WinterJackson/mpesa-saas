"use client";

import { SignUp } from "@clerk/nextjs";
import { useTheme } from "@wrksz/themes/client";
import { clerkThemeVariables } from "@/lib/clerk-appearance";

/**
 * Sign-up card, themed off the resolved light/dark theme so every Clerk surface
 * matches the rest of the app — card-black in dark mode. Shared color variables
 * come from clerkThemeVariables; the elements below only fine-tune layout. The
 * post-sign-up destination is computed on the server and passed in.
 */
export function ThemedSignUp({ fallbackRedirectUrl }: { fallbackRedirectUrl: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <SignUp
      fallbackRedirectUrl={fallbackRedirectUrl}
      appearance={{
        variables: clerkThemeVariables(isDark),
        elements: {
          rootBox: "w-full mx-auto",
          cardBox: "w-full shadow-floating-header",
          card: "bg-card border border-border shadow-sm w-full",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton: "border-border text-foreground hover:bg-muted/50",
          socialButtonsBlockButtonText: "text-foreground font-medium",
          dividerLine: "bg-border",
          dividerText: "text-muted-foreground",
          formFieldLabel: "text-foreground",
          formFieldInput: "bg-background border-border text-foreground focus:ring-primary",
          formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
          footerActionText: "text-muted-foreground",
          footerActionLink: "text-primary hover:text-primary/90",
        },
      }}
    />
  );
}
