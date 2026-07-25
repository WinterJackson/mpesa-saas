/**
 * Shared, theme-aware Clerk appearance variables. Every Clerk surface in the
 * app — sign-in, sign-up, the UserButton avatar popover, and the embedded
 * UserProfile — feeds these into `appearance.variables` so they all use the
 * exact same PaySwift color tokens from globals.css, including the platform's
 * card-black in dark mode (never Clerk's default white).
 *
 * Callers are client components: they read the resolved theme via
 * `useTheme()` from `@wrksz/themes/client` and pass `isDark` in. Values mirror
 * the `--card` / `--background` / `--foreground` / `--muted-foreground` tokens.
 */
export function clerkThemeVariables(isDark: boolean) {
  return {
    colorPrimary: "#132a13",
    colorPrimaryForeground: "oklch(0.985 0 0)",
    colorBackground: isDark ? "oklch(0.205 0 0)" : "oklch(1 0 0)",
    colorForeground: isDark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)",
    colorMutedForeground: isDark ? "oklch(0.708 0 0)" : "oklch(0.556 0 0)",
    colorInput: isDark ? "oklch(0.145 0 0)" : "oklch(1 0 0)",
    colorInputForeground: isDark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)",
    borderRadius: "0.625rem",
  };
}
