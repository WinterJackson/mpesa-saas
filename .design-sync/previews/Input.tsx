import { Input, Label } from "payswift";

export const Default = () => (
  <div style={{ maxWidth: 320 }}>
    <Input placeholder="Search transactions…" />
  </div>
);

export const WithLabel = () => (
  <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
    <Label htmlFor="phone">M-Pesa phone number</Label>
    <Input id="phone" type="tel" placeholder="2547XXXXXXXX" defaultValue="254712345678" />
  </div>
);

export const AmountField = () => (
  <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
    <Label htmlFor="amount">Amount (KES)</Label>
    <Input id="amount" type="number" defaultValue="2500" />
  </div>
);

export const Disabled = () => (
  <div style={{ maxWidth: 320 }}>
    <Input placeholder="Locked field" disabled />
  </div>
);
