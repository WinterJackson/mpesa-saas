import Link from 'next/link';
import { listAllOrganizations } from '@/lib/repositories/admin';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Organizations - PaySwift Admin',
};

export default async function AdminOrganizationsPage() {
  const organizations = await listAllOrganizations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">{organizations.length} total.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business Name</TableHead>
            <TableHead>KYC Status</TableHead>
            <TableHead>Environment</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Transactions</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell>
                <Link href={`/admin/organizations/${org.id}`} className="font-medium hover:underline">
                  {org.businessName}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={org.kycStatus === 'approved' ? 'default' : org.kycStatus === 'rejected' ? 'destructive' : 'secondary'}>
                  {org.kycStatus}
                </Badge>
              </TableCell>
              <TableCell className="capitalize">{org.environment}</TableCell>
              <TableCell>{org._count.memberships}</TableCell>
              <TableCell>{org._count.transactions}</TableCell>
              <TableCell>{org.createdAt.toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
