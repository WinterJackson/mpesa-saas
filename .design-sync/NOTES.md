# design-sync notes — PaySwift UI Primitives

Project: **PaySwift UI Primitives** (`95c305eb-5a3c-4722-916e-a1b4fe8f6769`) —
a NEW project, deliberately separate from the pre-existing hand-curated
"PaySwift Design System" (`2cb7596b-…`, has ui_kits/guidelines/logos, NOT built
by this skill — do not sync over it).

## This repo is off the converter's normal envelope
- It's a **Next.js app**, not a published component library: no `dist/`, no
  barrel export, no Storybook. So the bundle entry is **hand-authored**:
  `.design-sync/ds-entry.tsx` re-exports the 12 `components/ui/*` primitives, and
  `cfg.entry` points at it. Discovery is driven by `cfg.componentSrcMap` (12
  pins), not auto-detection. `cfg.tsconfig` = `./tsconfig.json` so the `@/` alias
  and each file's `@/lib/utils` import resolve during esbuild bundling.
- Scope = the 12 `components/ui` primitives + Tailwind tokens ONLY. The feature
  components (admin/billing/dashboard/…) are app code (Clerk/Next server deps) and
  are intentionally NOT synced.

## Re-sync MUST regenerate the CSS first
`cfg.cssEntry` = `.design-sync/compiled.css` is a **build artifact, gitignored**.
Regenerate it before every build (it carries the tokens + all Tailwind utilities):
```
npx --yes @tailwindcss/cli@4 -i app/globals.css -o .design-sync/compiled.css
```
On a fresh clone this file won't exist — the build fails with `[CSS_IMPORT_MISSING]`
until you run that command.

## Render check uses system Chrome (no playwright download)
No `ms-playwright` chromium is cached; the harness runs against system Chrome:
prefix validate/capture/driver with `DS_CHROMIUM_PATH=/usr/bin/google-chrome`.

## Known render warns (triaged legitimate — not new)
- `[TOKENS_MISSING] --radius-base, --color-surface, --shadow-card, --tw` —
  Tailwind‑internal / runtime‑injected vars, not real missing design tokens.
  All previews render clean; do not chase.
- `[FONT_MISSING] "Cambria"` — Cambria is only a **serif fallback name** inside
  Tailwind's default `--font-serif` stack; nothing in the DS uses serif. Accepted
  (system font).

## Toaster is a floor card by design
`sonner`'s `Toaster` is an imperative/portal toast container (needs the
`@wrksz/themes` theme context, has no static visual). Left unauthored on purpose.
The other 11 have authored previews, all graded good.

## Overlays
`Dialog` and `DropdownMenu` previews use `defaultOpen` + `cfg.overrides.<Name>
= {cardMode:"single", viewport:"…"}` so the open state renders inside the card.
`Table` uses `cardMode:"column"` (wide). Base‑UI triggers take `render={<…/>}`,
and `DropdownMenuLabel` must be inside a `DropdownMenuGroup` (else
`MenuGroupContext is missing`).

## Re-sync risks (what can silently go stale)
- **Brand fonts not shipped.** The app serves Inter (`--font-inter`) and Outfit
  (`--font-outfit`) via `next/font` at runtime, so they are referenced by CSS var
  but never shipped — previews fall back to **system sans**. Legible but off‑brand.
  To fix: add the Inter/Outfit `@font-face` + woff2 via `cfg.extraFonts`.
- **Amounts/dates in previews are hard-coded** sample content (KES values, 2026
  dates, masked phones) — cosmetic only.
- **compiled.css tracks app/globals.css.** If the token palette changes, the
  regenerate step above picks it up; if you forget it, the build uses a stale CSS.
- **The barrel is manual.** Adding/removing a `components/ui/*` primitive means
  editing `.design-sync/ds-entry.tsx` AND `cfg.componentSrcMap` together.
