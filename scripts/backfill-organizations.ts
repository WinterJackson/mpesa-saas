import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local for database + Clerk connection.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Prisma 7 in this project runs through the Neon driver adapter (see lib/db.ts);
// a bare `new PrismaClient()` throws. Construct the adapter the same way.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Standalone-safe Clerk client. `clerkClient()` from @clerk/nextjs/server only
// resolves the secret key inside the Next.js runtime; a plain script needs the
// backend client constructed with an explicit secretKey.
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

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

  // organizationId is now NOT NULL (migration 20260723051942), so Prisma's typed
  // `where: { organizationId: null }` no longer compiles. Raw SQL still finds any
  // stragglers (returns none once the backfill + NOT NULL migration have run) —
  // this keeps the completed one-off script honest and re-runnable-safe.
  const nullOrgIds = (await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Merchant" WHERE "organizationId" IS NULL
  `).map((r) => r.id);
  const merchants = nullOrgIds.length
    ? await prisma.merchant.findMany({ where: { id: { in: nullOrgIds } } })
    : [];

  const failures: { id: string; businessName: string; error: string }[] = [];

  if (merchants.length === 0) {
    console.log('No merchants need backfilling — every Merchant already has an Organization.');
  } else {
    console.log(`Found ${merchants.length} merchant(s) needing an Organization.`);

    for (const merchant of merchants) {
      console.log(`Backfilling merchant ${merchant.id} (${merchant.businessName})...`);

      try {
        // Synthetic/demo merchants (e.g. demo_user_123, used by the public demo
        // store for anonymous visitors) are NOT real Clerk users — a Clerk
        // createOrganization(createdBy) call would fail. Give them a local-only
        // Organization with a deterministic synthetic clerkOrgId instead.
        const isSyntheticUser = !merchant.clerkUserId.startsWith('user_');

        let clerkOrgId: string;
        if (isSyntheticUser) {
          clerkOrgId = `synthetic_org_${merchant.clerkUserId}`;
          console.log(`  Synthetic user — creating local-only Organization (${clerkOrgId}), no Clerk org.`);
        } else {
          // Real Clerk user: create a matching Clerk Organization owned by them.
          const clerkOrg = await clerk.organizations.createOrganization({
            name: merchant.businessName,
            createdBy: merchant.clerkUserId,
          });
          clerkOrgId = clerkOrg.id;
        }

        // Create the local Organization + owner Membership + link the Merchant,
        // cascading organizationId onto its existing ApiKey/Transaction rows — atomically.
        await prisma.$transaction(async (tx) => {
          const organization = await tx.organization.create({
            data: {
              clerkOrgId,
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

        console.log(`  -> Organization ${clerkOrgId} created and linked.`);
      } catch (err: unknown) {
        // Isolate per-merchant failures so one bad row doesn't abort the whole
        // backfill. The `where: { organizationId: null }` filter makes the whole
        // script safely re-runnable to retry only the ones that failed.
        const error = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED for merchant ${merchant.id} (${merchant.businessName}): ${error}`);
        failures.push({ id: merchant.id, businessName: merchant.businessName, error });
      }

      await sleep(DELAY_MS);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} merchant(s) failed to backfill:`);
    for (const f of failures) console.error(`  - ${f.businessName} (${f.id}): ${f.error}`);
    console.error('Re-run this script to retry them (already-linked merchants are skipped).');
  }

  // Explicit zero-NULL verification, per this phase's ground rule that the
  // NOT NULL migration must be gated on this check, not assumed. Raw SQL (see
  // note above) since organizationId is now NOT NULL in the Prisma types.
  const countNulls = async (table: 'Merchant' | 'ApiKey' | 'Transaction') => {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${table}" WHERE "organizationId" IS NULL`
    );
    return Number(rows[0].n);
  };
  const [merchantNulls, apiKeyNulls, transactionNulls] = await Promise.all([
    countNulls('Merchant'),
    countNulls('ApiKey'),
    countNulls('Transaction'),
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
