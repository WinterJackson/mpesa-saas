import { listPendingKycDocuments } from '@/lib/repositories/kyc-documents';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KycReviewActions } from '@/components/admin/kyc-review-actions';

export const metadata = {
  title: 'KYC Review - PaySwift Admin',
};

export default async function AdminKycReviewPage() {
  const documents = await listPendingKycDocuments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KYC Review Queue</h1>
        <p className="text-sm text-muted-foreground">{documents.length} pending.</p>
      </div>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to review right now.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Document Type</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.organization.businessName}</TableCell>
                <TableCell className="capitalize">{doc.type.replace(/_/g, ' ')}</TableCell>
                <TableCell>{doc.createdAt.toLocaleString()}</TableCell>
                <TableCell>
                  <KycReviewActions documentId={doc.id} organizationId={doc.organizationId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
