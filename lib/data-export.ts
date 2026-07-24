import { listTransactions } from '@/lib/repositories/transactions';
import { listPayouts } from '@/lib/repositories/payouts';
import { listRefunds } from '@/lib/repositories/refunds';
import { listDeliveries } from '@/lib/repositories/webhook-deliveries';
import { listMemberships, type Organization, type OrganizationMerchant } from '@/lib/repositories/organizations';

// Builds a merchant's own-data export (Phase 4, Stage 9 — Kenya DPA
// right-of-access groundwork). Reuses the existing org-scoped
// lib/repositories/* functions, so every query is already tenant-scoped;
// nothing here can reach another organization's data. Deliberately does NOT
// include any secret material (API key hashes, encrypted Daraja
// credentials, webhook secrets) — those are org-owned but not personal data
// subject to access, and exporting them would be its own security risk.

const EXPORT_ROW_LIMIT = 1000;

export interface DataExport {
  exportedAt: string;
  organization: {
    id: string;
    businessName: string;
    kycStatus: string;
    environment: string;
    createdAt: Date;
  };
  merchant: {
    businessName: string;
    webhookUrl: string | null;
    shopifyShopDomain: string | null;
    environment: string;
  } | null;
  team: Array<{ clerkUserId: string; role: string; createdAt: Date }>;
  transactions: unknown[];
  payouts: unknown[];
  refunds: unknown[];
  webhookDeliveries: unknown[];
}

export async function buildDataExport(
  organization: Organization,
  merchant: OrganizationMerchant | null
): Promise<DataExport> {
  const [transactions, payouts, refunds, deliveries, memberships] = await Promise.all([
    listTransactions(organization.id, { take: EXPORT_ROW_LIMIT }),
    listPayouts(organization.id, { take: EXPORT_ROW_LIMIT }),
    listRefunds(organization.id, { take: EXPORT_ROW_LIMIT }),
    listDeliveries(organization.id, { limit: EXPORT_ROW_LIMIT }),
    listMemberships(organization.id),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    organization: {
      id: organization.id,
      businessName: organization.businessName,
      kycStatus: organization.kycStatus,
      environment: organization.environment,
      createdAt: organization.createdAt,
    },
    merchant: merchant
      ? {
          businessName: merchant.businessName,
          webhookUrl: merchant.webhookUrl,
          shopifyShopDomain: merchant.shopifyShopDomain,
          environment: merchant.environment,
        }
      : null,
    team: memberships.map((m) => ({ clerkUserId: m.clerkUserId, role: m.role, createdAt: m.createdAt })),
    transactions,
    payouts,
    refunds,
    webhookDeliveries: deliveries.data,
  };
}
