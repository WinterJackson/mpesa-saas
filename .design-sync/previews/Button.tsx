import { Button } from "payswift";

export const Default = () => <Button>Send payment</Button>;

export const Variants = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <Button variant="default">Pay KES 2,500</Button>
    <Button variant="secondary">Save draft</Button>
    <Button variant="outline">Export</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="destructive">Reverse payout</Button>
    <Button variant="link">View receipt</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const Disabled = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <Button disabled>Processing…</Button>
    <Button variant="outline" disabled>Unavailable</Button>
  </div>
);
