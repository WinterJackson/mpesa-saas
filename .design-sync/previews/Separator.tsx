import { Separator } from "payswift";

export const Horizontal = () => (
  <div style={{ maxWidth: 320 }}>
    <div style={{ fontSize: 14, fontWeight: 600 }}>Payout details</div>
    <Separator style={{ margin: "12px 0" }} />
    <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
      Settled to M-Pesa ending 78
    </div>
  </div>
);

export const Vertical = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 24, fontSize: 13 }}>
    <span>Sandbox</span>
    <Separator orientation="vertical" />
    <span>API v1</span>
    <Separator orientation="vertical" />
    <span>Nairobi</span>
  </div>
);
