import { Skeleton } from "payswift";

export const LoadingCard = () => (
  <div style={{ display: "grid", gap: 10, maxWidth: 320 }}>
    <Skeleton style={{ height: 20, width: "60%" }} />
    <Skeleton style={{ height: 14, width: "90%" }} />
    <Skeleton style={{ height: 14, width: "80%" }} />
  </div>
);

export const LoadingRow = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 320 }}>
    <Skeleton style={{ height: 40, width: 40, borderRadius: 9999 }} />
    <div style={{ display: "grid", gap: 8, flex: 1 }}>
      <Skeleton style={{ height: 14, width: "70%" }} />
      <Skeleton style={{ height: 12, width: "40%" }} />
    </div>
  </div>
);
