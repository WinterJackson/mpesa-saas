import { listOpenMismatches } from '@/lib/repositories/reconciliation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ResolveMismatchButton } from '@/components/admin/resolve-mismatch-button';

export const metadata = {
  title: 'Reconciliation - PaySwift Admin',
};

export default async function AdminReconciliationPage() {
  const mismatches = await listOpenMismatches();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          {mismatches.length} open. Records a Daraja callback never resolved — review, then resolve or ignore.
          Nothing is auto-failed.
        </p>
      </div>
      {mismatches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open mismatches. The ledger is clean.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mismatches.map((m) => (
              <TableRow key={m.id}>
                <TableCell><Badge variant="secondary">{m.resourceType}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{m.resourceId}</TableCell>
                <TableCell className="max-w-md text-xs text-muted-foreground">{m.reason}</TableCell>
                <TableCell>{m.detectedAt.toLocaleString()}</TableCell>
                <TableCell><ResolveMismatchButton mismatchId={m.id} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
