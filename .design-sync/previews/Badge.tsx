import { Badge } from "payswift";

export const Default = () => <Badge>New</Badge>;

export const PaymentStatuses = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <Badge>Completed</Badge>
    <Badge variant="secondary">Pending</Badge>
    <Badge variant="destructive">Failed</Badge>
    <Badge variant="outline">Refunded</Badge>
  </div>
);

export const Variants = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <Badge variant="default">default</Badge>
    <Badge variant="secondary">secondary</Badge>
    <Badge variant="destructive">destructive</Badge>
    <Badge variant="outline">outline</Badge>
  </div>
);
