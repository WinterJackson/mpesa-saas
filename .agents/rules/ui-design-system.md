# UI/UX Design System Enforcement

**Purpose:** This rule exists so no future prompt needs to re-explain styling conventions. It applies automatically to any task touching frontend code in this repo, regardless of how the request is worded — a one-line "make this prettier," a full new screen, or a "quick fix to the button" all fall under this rule with equal force.

**Canonical reference:** @DESIGN_SYSTEM.md at the repo root is the single source of truth for tokens, components, and patterns. This rule file states the non-negotiable constraints; that file states the concrete values. If they ever appear to conflict, `DESIGN_SYSTEM.md` wins — flag the conflict instead of guessing.

## Hard constraints — never violate these

1. **No hardcoded colors.** Never write a literal hex, rgb, or hsl value in a component, CSS file, or inline style. Every color must resolve to a token defined in `app/globals.css` / the Tailwind theme config. If a needed color role doesn't exist yet, add it to the token layer and to `DESIGN_SYSTEM.md` first, then consume it from there — never inline it "just this once."
2. **No arbitrary spacing/sizing values.** Don't use Tailwind arbitrary-value syntax (`mt-[13px]`, `w-[247px]`, `text-[15px]`) to sidestep the existing spacing/typography scale. If the scale genuinely doesn't have what's needed, that's a signal to extend the scale in `DESIGN_SYSTEM.md`, not to bypass it locally.
3. **No new primitive components outside `components/ui/`.** Buttons, inputs, dialogs, cards, badges, selects, etc. are defined once, in `components/ui/`. Feature code composes and configures them (including via `class-variance-authority` variants) — it never forks a primitive inline inside a feature file or route.
4. **No duplicate interaction patterns.** Before building a loading state, empty state, error state, confirmation dialog, form layout, or toast, find the closest existing example already shipped in the app and match it exactly. Do not invent a second pattern for something that already has one. If genuinely nothing comparable exists yet, add the new pattern to `DESIGN_SYSTEM.md` as part of the same change, not as a one-off.
5. **Skeletons, not spinners**, for anything data-table or list-shaped that's loading.
6. **One toast system.** Use the existing toast library already wired into this app — do not add a second one or hand-roll toast UI.
7. **One icon set.** Use whichever icon library is already imported elsewhere in the codebase — check existing imports before adding a new icon package.
8. **Accessibility is not optional.** Every new interactive element must be keyboard-operable and meet WCAG AA contrast. This is checked the same way correctness is checked — not treated as a later pass.
9. **Responsive by default.** Every new screen must work down to mobile width without a separate "make it responsive later" step.
10. **Theme parity.** This app supports light/dark via `next-themes`. Every new screen must be checked in both modes before it's considered done — not just whichever theme happened to be active while building it.
11. **Feature-based file organization.** New UI belongs under its feature's route folder with co-located components (matching the existing project convention) — not dumped into one flat, growing components folder.

## Process — apply this before writing any UI code

1. Check `DESIGN_SYSTEM.md` for the relevant tokens/pattern.
2. Find the most similar existing screen or component already in the app and match its structure, spacing, and states.
3. Only introduce something new (a token, a pattern, a primitive) if neither of the above covers the need — and when you do, add it to `DESIGN_SYSTEM.md` in the same change so it's now the documented convention for next time, not a silent one-off.
4. If a specific instruction in a prompt would require breaking one of the hard constraints above, say so explicitly and propose the compliant alternative rather than silently doing something inconsistent with the rest of the app.

**Silence on styling detail in a prompt is not permission to improvise.** Absence of instruction defaults to whatever is already documented here and in `DESIGN_SYSTEM.md` — never to whatever seems reasonable in isolation.
