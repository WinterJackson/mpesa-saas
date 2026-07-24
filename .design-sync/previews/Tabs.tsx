import { Tabs, TabsList, TabsTrigger, TabsContent } from "payswift";

export const Default = () => (
  <Tabs defaultValue="payments" style={{ maxWidth: 420 }}>
    <TabsList>
      <TabsTrigger value="payments">Payments</TabsTrigger>
      <TabsTrigger value="payouts">Payouts</TabsTrigger>
      <TabsTrigger value="refunds">Refunds</TabsTrigger>
    </TabsList>
    <TabsContent value="payments">
      <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 12 }}>
        1,284 payments collected this month · KES 184,200.
      </p>
    </TabsContent>
    <TabsContent value="payouts">
      <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 12 }}>
        18 payouts settled to M-Pesa.
      </p>
    </TabsContent>
    <TabsContent value="refunds">
      <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 12 }}>
        3 refunds processed this month.
      </p>
    </TabsContent>
  </Tabs>
);
