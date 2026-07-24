import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Badge,
} from "payswift";

export const Transactions = () => (
  <Table>
    <TableCaption>Recent M-Pesa transactions</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Receipt</TableHead>
        <TableHead>Customer</TableHead>
        <TableHead>Status</TableHead>
        <TableHead style={{ textAlign: "right" }}>Amount</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell style={{ fontFamily: "var(--font-mono)" }}>SLJ7XK2P9Q</TableCell>
        <TableCell>2547•••••78</TableCell>
        <TableCell><Badge>Completed</Badge></TableCell>
        <TableCell style={{ textAlign: "right" }}>KES 2,500</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ fontFamily: "var(--font-mono)" }}>SLJ7XM4T1R</TableCell>
        <TableCell>2547•••••12</TableCell>
        <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
        <TableCell style={{ textAlign: "right" }}>KES 900</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ fontFamily: "var(--font-mono)" }}>SLJ7XP8W3K</TableCell>
        <TableCell>2547•••••44</TableCell>
        <TableCell><Badge variant="destructive">Failed</Badge></TableCell>
        <TableCell style={{ textAlign: "right" }}>KES 12,000</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
