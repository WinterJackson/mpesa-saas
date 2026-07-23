import { listAllInvoices } from '@/lib/repositories/billing';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MarkInvoicePaidButton } from '@/components/admin/mark-invoice-paid-button';

export const metadata = {
  title: 'Billing - PaySwift Admin',
};

export default async function AdminBillingPage() {
  const invoices = await listAllInvoices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manual collection this phase — confirm payment out-of-band, then mark the invoice paid.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Amount (KES)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.subscription.organization.businessName}</TableCell>
              <TableCell>{invoice.amount.toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'failed' ? 'destructive' : 'secondary'}>
                  {invoice.status}
                </Badge>
              </TableCell>
              <TableCell>{invoice.issuedAt.toLocaleDateString()}</TableCell>
              <TableCell>
                {invoice.status === 'pending' && <MarkInvoicePaidButton invoiceId={invoice.id} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
