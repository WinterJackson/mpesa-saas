import { auth } from '@clerk/nextjs/server';
import { getLatestBalancesAcrossOrganizations } from '@/lib/repositories/admin-balances';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshBalanceButton } from './refresh-balance-button';

export const metadata = { title: 'Balances - PaySwift Admin' };

export default async function AdminBalancesPage() {
  const { userId } = await auth(); // layout already guarantees this is an active admin
  const rows = await getLatestBalancesAcrossOrganizations(userId!);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shortcode Balances</h1>
        <p className="text-sm text-muted-foreground">
          Live organizations&apos; most recently known M-Pesa working balance, lowest first. Snapshots update whenever an
          Account Balance query resolves — they can be stale between checks.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live organizations yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Last checked</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.organizationId}>
                <TableCell>{r.businessName}</TableCell>
                <TableCell>{r.workingBalance != null ? `KES ${r.workingBalance.toLocaleString('en-KE')}` : '—'}</TableCell>
                <TableCell>KES {r.effectiveThresholdKes.toLocaleString('en-KE')}</TableCell>
                <TableCell>{r.checkedAt ? r.checkedAt.toLocaleString() : 'Never checked'}</TableCell>
                <TableCell>
                  {r.belowThreshold ? <Badge variant="destructive">Low</Badge> : <Badge variant="secondary">OK</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <RefreshBalanceButton organizationId={r.organizationId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
