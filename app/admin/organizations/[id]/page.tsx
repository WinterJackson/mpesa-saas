import { notFound } from 'next/navigation';
import { findOrganizationWithDetails } from '@/lib/repositories/admin';
import { listAuditLogsForOrganization } from '@/lib/repositories/audit-log';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImpersonateButton } from '@/components/admin/impersonate-button';

export const metadata = {
  title: 'Organization - PaySwift Admin',
};

export default async function AdminOrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organization = await findOrganizationWithDetails(id);

  if (!organization) {
    notFound();
  }

  const auditLogs = await listAuditLogsForOrganization(id, 25);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{organization.businessName}</h1>
          <p className="text-sm text-muted-foreground">{organization.id}</p>
        </div>
        <ImpersonateButton organizationId={organization.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">KYC</span>
              <Badge variant={organization.kycStatus === 'approved' ? 'default' : organization.kycStatus === 'rejected' ? 'destructive' : 'secondary'}>
                {organization.kycStatus}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment</span>
              <span className="capitalize">{organization.environment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Members</span>
              <span>{organization.memberships.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Daraja credentials</span>
              <span>{organization.darajaCredential?.isPooledSandbox ? 'Pooled sandbox' : organization.darajaCredential ? 'Custom' : 'Not configured'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">KYC Documents</CardTitle>
            <CardDescription>{organization.kycDocuments.length} submitted</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {organization.kycDocuments.length === 0 && (
              <p className="text-muted-foreground">No documents submitted yet.</p>
            )}
            {organization.kycDocuments.map((doc) => (
              <div key={doc.id} className="flex justify-between">
                <span className="capitalize">{doc.type.replace(/_/g, ' ')}</span>
                <Badge variant={doc.reviewStatus === 'approved' ? 'default' : doc.reviewStatus === 'rejected' ? 'destructive' : 'secondary'}>
                  {doc.reviewStatus}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {auditLogs.length === 0 && <p className="text-muted-foreground">No audit events yet.</p>}
          {auditLogs.map((log) => (
            <div key={log.id} className="flex justify-between border-b py-1 last:border-0">
              <span>{log.action}</span>
              <span className="text-muted-foreground">{log.createdAt.toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
