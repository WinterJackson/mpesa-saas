# Design System

This is the single source of truth for tokens, components, and UI patterns for PaySwift.

## 1. Design Tokens

All semantic colors are defined in `app/globals.css`. Never use hardcoded colors (hex, rgb, etc.) in your components.

### Semantic Status Colors
*   `--status-completed`: Green
*   `--status-pending`: Blue
*   `--status-failed`: Red
*   `--status-cancelled`: Amber

### Base Colors
*   `--background` / `--foreground`: Base page background and default text
*   `--card` / `--card-foreground`: Elevated surface (cards, dialogs)
*   `--popover` / `--popover-foreground`: Transient surfaces (dropdowns, tooltips)
*   `--primary` / `--primary-foreground`: M-Pesa green tint (primary actions)
*   `--secondary` / `--secondary-foreground`: Secondary actions/elements
*   `--muted` / `--muted-foreground`: Subdued backgrounds and text
*   `--accent` / `--accent-foreground`: Hover states and subtle highlights
*   `--destructive` / `--destructive-foreground`: Error states and destructive actions
*   `--border`: Subtle borders and dividers
*   `--input`: Form input borders
*   `--ring`: Focus rings

### Backgrounds & Overlays
*   `--background-image-dashboard`: Dashboard background image (auto-switches between light and dark mode images)

### Typography & Sizing
*   **Fonts**: We use `font-sans` (Geist Sans) and `font-mono` (Geist Mono). No custom font faces should be added without updating this document.
*   **Spacing**: Rely on standard Tailwind spacing utilities (e.g., `p-4`, `m-2`, `gap-6`). Do not use arbitrary values like `gap-[13px]`.
*   **Radii**: Base border radius is `10px` (`--radius`). Use standard Tailwind classes `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, etc.

## 2. Primitives

Do not build custom primitive components. Compose the following existing primitives found in `components/ui/`:

*   `Badge`
*   `Button`
*   `Card`
*   `Dialog`
*   `DropdownMenu`
*   `Input`
*   `Label`
*   `Separator`
*   `Skeleton` (Use for loading states instead of spinners)
*   `Sonner` (Toasts)
*   `Table`
*   `Tabs`

## 3. UI Patterns

*   **Toasts**: Use `sonner` via `toast()` for all notifications and transient feedback.
*   **Loading States**: Use `<Skeleton>` components that match the shape of the content being loaded. Do not use spinners for lists or tables.
*   **Dark Mode**: Handled via `next-themes`. Ensure `dark:` variants (or CSS variables) provide sufficient contrast in both modes.
*   **Icons**: Use `lucide-react` (standard in shadcn/ui). Check existing imports before adding a new icon.
*   **Feature-based Structure**: Colocate feature-specific components inside their respective route folders rather than dumping them in `components/ui/`.
