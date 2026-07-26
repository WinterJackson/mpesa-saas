import Link from 'next/link';
import { adminSearchTransactions } from '@/lib/repositories/admin-transactions';
import { requireAdmin } from '@/lib/admin-auth';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { StatusBadge } from '@/components/dashboard/status-badge';

export const metadata = {
  title: 'Transactions - PaySwift Admin',
};

// Mask phone number: 254712345678 -> 2547***5678
function maskPhone(phone: string) {
  if (!phone || phone.length < 8) return phone;
  return `${phone.substring(0, 4)}***${phone.substring(phone.length - 4)}`;
}

export default async function AdminTransactionsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const adminAuth = await requireAdmin(userId);
  if (!adminAuth.allowed) redirect('/');

  const searchParams = await props.searchParams;
  
  const phone = typeof searchParams.phone === 'string' && searchParams.phone.trim() ? searchParams.phone.trim() : undefined;
  const mpesaReceipt = typeof searchParams.mpesaReceipt === 'string' && searchParams.mpesaReceipt.trim() ? searchParams.mpesaReceipt.trim() : undefined;
  const organizationName = typeof searchParams.organizationName === 'string' && searchParams.organizationName.trim() ? searchParams.organizationName.trim() : undefined;
  const transactionId = typeof searchParams.transactionId === 'string' && searchParams.transactionId.trim() ? searchParams.transactionId.trim() : undefined;
  
  const hasQuery = Boolean(phone || mpesaReceipt || organizationName || transactionId);

  const transactions = hasQuery 
    ? await adminSearchTransactions(
        { phone, mpesaReceipt, organizationName, transactionId },
        adminAuth.admin.clerkUserId
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cross-Tenant Transaction Search</h1>
        <p className="text-sm text-muted-foreground">Search for transactions across all organizations. Actions here are strictly audit-logged.</p>
      </div>

      <div className="p-4 bg-muted/30 border border-border rounded-lg">
        <form method="GET" action="/admin/transactions" className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label htmlFor="mpesaReceipt" className="text-sm font-medium text-muted-foreground">M-Pesa Receipt</label>
            <Input id="mpesaReceipt" name="mpesaReceipt" placeholder="e.g. QEG12A3B4C" defaultValue={mpesaReceipt} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-muted-foreground">Phone Number</label>
            <Input id="phone" name="phone" placeholder="e.g. 254712345678" defaultValue={phone} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="transactionId" className="text-sm font-medium text-muted-foreground">Internal Transaction ID</label>
            <Input id="transactionId" name="transactionId" placeholder="e.g. tx_12345..." defaultValue={transactionId} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="organizationName" className="text-sm font-medium text-muted-foreground">Organization Name</label>
            <Input id="organizationName" name="organizationName" placeholder="e.g. Demo Store" defaultValue={organizationName} />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button type="submit">
              <Search className="size-4 mr-2" />
              Search
            </Button>
          </div>
        </form>
      </div>

      {!hasQuery ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Ready to search</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Enter one or more criteria above to look up transactions across the entire platform.
          </p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
          <h3 className="text-base font-medium">No transactions found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search criteria.
          </p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount (KES)</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/admin/organizations/${t.organizationId}`} className="font-medium hover:underline text-primary">
                      {t.organization.businessName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{t.mpesaReceipt || '-'}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{maskPhone(t.phone)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.id.split('_').pop()?.substring(0, 8) || t.id.substring(0, 8)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {t.createdAt.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
