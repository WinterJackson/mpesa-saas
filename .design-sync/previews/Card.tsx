import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "payswift";

export const PaymentSummary = () => (
  <Card style={{ maxWidth: 380 }}>
    <CardHeader>
      <CardTitle>Payment received</CardTitle>
      <CardDescription>M-Pesa STK push · 24 Jul 2026</CardDescription>
      <CardAction>
        <Badge>Completed</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <span style={{ color: "var(--muted-foreground)" }}>Amount</span>
        <span style={{ fontWeight: 600 }}>KES 2,500</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 8 }}>
        <span style={{ color: "var(--muted-foreground)" }}>Customer</span>
        <span>2547•••••78</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 8 }}>
        <span style={{ color: "var(--muted-foreground)" }}>Receipt</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>SLJ7XK2P9Q</span>
      </div>
    </CardContent>
    <CardFooter style={{ gap: 8 }}>
      <Button variant="outline">View receipt</Button>
      <Button>Refund</Button>
    </CardFooter>
  </Card>
);

export const Simple = () => (
  <Card style={{ maxWidth: 320 }}>
    <CardHeader>
      <CardTitle>Monthly volume</CardTitle>
      <CardDescription>Transactions this billing period</CardDescription>
    </CardHeader>
    <CardContent>
      <div style={{ fontSize: 30, fontWeight: 700 }}>KES 184,200</div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
        1,284 successful payments
      </p>
    </CardContent>
  </Card>
);
