import { PrismaClient } from '@prisma/client';
import { clerkClient } from '@clerk/nextjs/server';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local for database + Clerk connection.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// Clerk's organization-creation endpoint is rate-limited; back off between
// calls when backfilling many pre-Phase-1 merchants at once.
const DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One-off backfill: every Merchant created before Phase 1 has no Organization.
 * For each, create a matching Clerk Organization (owned by the merchant's
 * existing Clerk user), then the local Organization + owner Membership, and
 * cascade organizationId onto that merchant's existing ApiKey/Transaction rows.
 *
 * Do NOT run this against production until the Organization/Membership
 * migration (prisma/migrations/20260722130410_add_organization_membership_tenant_model)
 * has been applied. After this script reports zero remaining NULLs, it is
 * safe to generate and apply the follow-up migration that makes
 * organizationId NOT NULL on Merchant/ApiKey/Transaction.
 */
async function main() {
  console.log('Starting Organization backfill for pre-Phase-1 merchants...');

  const merchants = await prisma.merchant.findMany({
    where: { organizationId: null },
  });

  if (merchants.length === 0) {
    console.log('No merchants need backfilling — every Merchant already has an Organization.');
  } else {
    console.log(`Found ${merchants.length} merchant(s) needing an Organization.`);

    const client = await clerkClient();

    for (const merchant of merchants) {
      console.log(`Backfilling merchant ${merchant.id} (${merchant.businessName})...`);

      // 1. Create a matching Clerk Organization, owned by the merchant's existing Clerk user.
      const clerkOrg = await client.organizations.createOrganization({
        name: merchant.businessName,
        createdBy: merchant.clerkUserId,
      });

      // 2. Create the local Organization + owner Membership + link the Merchant,
      //    cascading organizationId onto its existing ApiKey/Transaction rows — atomically.
      await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            clerkOrgId: clerkOrg.id,
            businessName: merchant.businessName,
            environment: merchant.environment,
            // Pre-Phase-1 merchants were already operating on the platform under
            // the old single-tenant model — grandfather them in as KYC-approved
            // rather than forcing a re-review through the new onboarding flow.
            kycStatus: 'approved',
          },
        });

        await tx.membership.create({
          data: {
            organizationId: organization.id,
            clerkUserId: merchant.clerkUserId,
            role: 'owner',
          },
        });

        await tx.merchant.update({
          where: { id: merchant.id },
          data: { organizationId: organization.id },
        });

        await tx.apiKey.updateMany({
          where: { merchantId: merchant.id },
          data: { organizationId: organization.id },
        });

        await tx.transaction.updateMany({
          where: { merchantId: merchant.id },
          data: { organizationId: organization.id },
        });
      });

      console.log(`  -> Organization ${clerkOrg.id} created and linked.`);
      await sleep(DELAY_MS);
    }
  }

  // Explicit zero-NULL verification, per this phase's ground rule that the
  // NOT NULL migration must be gated on this check, not assumed.
  const [merchantNulls, apiKeyNulls, transactionNulls] = await Promise.all([
    prisma.merchant.count({ where: { organizationId: null } }),
    prisma.apiKey.count({ where: { organizationId: null } }),
    prisma.transaction.count({ where: { organizationId: null } }),
  ]);

  console.log('--- Zero-NULL verification ---');
  console.log(`Merchant.organizationId NULLs remaining: ${merchantNulls}`);
  console.log(`ApiKey.organizationId NULLs remaining: ${apiKeyNulls}`);
  console.log(`Transaction.organizationId NULLs remaining: ${transactionNulls}`);

  if (merchantNulls > 0 || apiKeyNulls > 0 || transactionNulls > 0) {
    console.error('Backfill incomplete — do NOT generate/apply the NOT NULL migration yet.');
    process.exitCode = 1;
  } else {
    console.log('All tenant-scoped rows have an organizationId. Safe to proceed with the NOT NULL migration.');
  }
}

main()
  .catch((e) => {
    console.error('Error running script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
