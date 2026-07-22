import { platformOverviewStats } from '@/lib/repositories/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Admin Overview - PaySwift',
};

export default async function AdminOverviewPage() {
  const stats = await platformOverviewStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
        <p className="text-sm text-muted-foreground">System-wide KPIs across every organization.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Organizations</CardDescription>
            <CardTitle className="text-3xl">{stats.organizationCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pending KYC Documents</CardDescription>
            <CardTitle className="text-3xl">{stats.pendingKycCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Transactions</CardDescription>
            <CardTitle className="text-3xl">{stats.transactionCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  );
}
