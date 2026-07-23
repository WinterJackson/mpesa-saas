import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listKycDocuments } from '@/lib/repositories/kyc-documents';
import { getCredentialSummary } from '@/lib/repositories/daraja-credentials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KycUploadCard } from '@/components/settings/kyc-upload-card';
import { GoLiveRequestCard } from '@/components/settings/go-live-request-card';

export const metadata = {
  title: 'KYC Verification - PaySwift',
  description: 'Business verification status and documents.',
};

export default async function KycSettingsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect('/sign-in');

  const context = await getOrganizationContext(userId, orgId);
  if (!context) redirect('/onboarding');

  const documents = await listKycDocuments(context.organization.id);
  const credentialSummary = await getCredentialSummary(context.organization.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KYC Verification</h1>
        <p className="text-sm text-muted-foreground">Required before your organization can go live with real M-Pesa payments.</p>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Status</CardDescription>
          <CardTitle className="flex items-center gap-2 text-xl capitalize">
            {context.organization.kycStatus}
            <Badge variant={context.organization.kycStatus === 'approved' ? 'default' : context.organization.kycStatus === 'rejected' ? 'destructive' : 'secondary'}>
              {context.organization.kycStatus === 'pending' ? 'Under review' : context.organization.kycStatus}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KycUploadCard documents={documents} />
        </CardContent>
      </Card>

      <GoLiveRequestCard
        kycApproved={context.organization.kycStatus === 'approved'}
        hasLiveCredentials={Boolean(credentialSummary?.hasLiveCredentials)}
        liveRequested={Boolean(context.organization.liveRequestedAt)}
        liveApproved={Boolean(context.organization.liveApprovedAt)}
      />
    </div>
  );
}
