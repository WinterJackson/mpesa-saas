# PaySwift UI Primitives — how to build with this system

These are the PaySwift **shadcn/ui + Base UI** primitives (React 19, Tailwind v4).
Twelve components on `window.PaySwiftUI`, styled entirely with **CSS design
tokens + Tailwind utility classes**. PaySwift is an M‑Pesa payments platform for
Kenyan merchants; the accent is a deep M‑Pesa green.

## Setup & theming
No React provider is required for styling — the tokens are plain CSS variables
applied globally through `styles.css` (already bound). Just render the
components. Light is the default; for **dark mode** put `class="dark"` on any
ancestor (all tokens have a `.dark` override). The one exception is `Toaster`
(sonner), which reads a theme hook and is meant to sit once at app root — it has
no standalone visual.

## Styling idiom — Tailwind v4 utilities over semantic tokens
Style with **utility classes**, and reach for the **semantic token utilities**
so everything stays on‑brand and theme‑aware. Never hard‑code hex — use these:

| Utility family | Use for |
|---|---|
| `bg-primary` / `text-primary-foreground` | primary actions, the M‑Pesa green |
| `bg-secondary` / `text-secondary-foreground` | secondary surfaces/buttons |
| `bg-muted` / `text-muted-foreground` | subtle fills, helper text |
| `bg-destructive` / `text-destructive` | refunds, reversals, failures |
| `bg-card` / `bg-background` / `text-foreground` | surfaces & base text |
| `border-border`, `rounded-lg` (`--radius` 10px) | dividers, card edges |

Every component takes a `className` (merged with `tailwind-merge`, so your
classes win). Variant‑driven components expose props instead of classes:
`Button` and `Badge` take `variant` (`default | secondary | outline | ghost |
destructive | link` — Badge omits ghost/link); `Button` also takes `size`
(`sm | default | lg | icon`); `Tabs` (`TabsList`) takes `variant` (`default | line`).

## Compound components
`Card`, `Dialog`, `DropdownMenu`, `Table`, and `Tabs` are families — compose
their parts: `Card`→`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/
`CardContent`/`CardFooter`; `Table`→`TableHeader`/`TableBody`/`TableRow`/
`TableHead`/`TableCell`/`TableCaption`; `Tabs`→`TabsList`/`TabsTrigger`/
`TabsContent`. Base‑UI triggers take a `render={<Button/>}` prop rather than
`asChild`. `DropdownMenuLabel` must sit inside a `DropdownMenuGroup`.

## Where the truth lives
Read `styles.css` (and its `@import`ed `_ds_bundle.css`) for the exact tokens and
utilities, and each component's `<Name>.d.ts` / `<Name>.prompt.md` for its props.

## Idiomatic example
```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Badge } from "payswift";

<Card className="max-w-sm">
  <CardHeader>
    <CardTitle>Payment received</CardTitle>
    <Badge>Completed</Badge>
  </CardHeader>
  <CardContent>
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">Amount</span>
      <span className="font-semibold">KES 2,500</span>
    </div>
  </CardContent>
  <CardFooter className="gap-2">
    <Button variant="outline">View receipt</Button>
    <Button variant="destructive">Refund</Button>
  </CardFooter>
</Card>
```
