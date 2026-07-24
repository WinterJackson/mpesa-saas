import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * Manual verification script (Phase 4, Stage 3) — proves Postgres Row-Level
 * Security actually blocks cross-tenant access at the DATABASE level for the
 * WebhookDelivery table, not just that the application code happens to add
 * the right `where` clause. Run after every migration that enables RLS on a
 * new table (see prisma/migrations/20260724000000_enable_rls_webhookdelivery_refund).
 *
 * Must connect via DATABASE_APP_URL (the restricted app_runtime role, see
 * scripts/create-app-runtime-role.ts) — DATABASE_URL's owner role has
 * BYPASSRLS and would make every check below trivially (and misleadingly)
 * pass.
 *
 * WebhookDelivery has no foreign-key-constrained organizationId (it's
 * denormalized, see prisma/schema.prisma), so this can use fully synthetic
 * organization ids with no dependent Organization/Merchant/Transaction rows
 * — cleanly created and deleted, safe to run against the live database.
 *
 * Usage: npx tsx scripts/verify-rls.ts
 */

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

  const connectionString = process.env.DATABASE_APP_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_APP_URL is not set — this script must connect as the restricted app_runtime role, not the owner role.'
    );
  }
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const ORG_A = `rls-verify-a-${Date.now()}`;
  const ORG_B = `rls-verify-b-${Date.now()}`;

  console.log(`Using synthetic organizations ${ORG_A} / ${ORG_B}\n`);

  console.log('1. An INSERT with no tenant/platform context set should be rejected...');
  let insertWasRejected = false;
  try {
    await prisma.webhookDelivery.create({
      data: { organizationId: ORG_A, url: 'https://rls-verify.example', payload: {}, event: 'rls.verify' },
    });
  } catch {
    insertWasRejected = true;
  }
  if (!insertWasRejected) {
    await prisma.webhookDelivery.deleteMany({ where: { organizationId: ORG_A } });
    throw new Error('RLS FAILED: an unscoped INSERT succeeded — FORCE ROW LEVEL SECURITY is not active');
  }
  console.log('   PASS: unscoped INSERT was rejected.\n');

  console.log('2. Seeding one row each for org A and org B via the platform bypass...');
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.is_platform_query', 'true', true)`;
    await tx.webhookDelivery.create({
      data: { organizationId: ORG_A, url: 'https://rls-verify.example', payload: {}, event: 'rls.verify' },
    });
    await tx.webhookDelivery.create({
      data: { organizationId: ORG_B, url: 'https://rls-verify.example', payload: {}, event: 'rls.verify' },
    });
  });
  console.log('   OK.\n');

  try {
    console.log("3. Org A's session should see ZERO rows belonging to org B...");
    const crossTenantRows = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.current_org_id', ${ORG_A}, true)`;
      return tx.webhookDelivery.findMany({ where: { organizationId: ORG_B } });
    });
    if (crossTenantRows.length !== 0) {
      throw new Error(`RLS FAILED: org A's session saw ${crossTenantRows.length} row(s) belonging to org B`);
    }
    console.log('   PASS.\n');

    console.log("4. Org A's session should see exactly its OWN row...");
    const ownRows = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.current_org_id', ${ORG_A}, true)`;
      return tx.webhookDelivery.findMany({ where: { organizationId: ORG_A } });
    });
    if (ownRows.length !== 1) {
      throw new Error(`Expected exactly 1 row for org A's own session, got ${ownRows.length}`);
    }
    console.log('   PASS.\n');

    console.log('5. A session with NO context set should see NEITHER row (default-deny)...');
    const noContextRows = await prisma.webhookDelivery.findMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    });
    if (noContextRows.length !== 0) {
      throw new Error(`RLS FAILED: an unscoped session saw ${noContextRows.length} row(s) — RLS is not enforced`);
    }
    console.log('   PASS.\n');

    console.log('6. The platform bypass should see BOTH rows...');
    const platformRows = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.is_platform_query', 'true', true)`;
      return tx.webhookDelivery.findMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
    });
    if (platformRows.length !== 2) {
      throw new Error(`Expected platform bypass to see both rows, got ${platformRows.length}`);
    }
    console.log('   PASS.\n');

    console.log('All RLS checks passed.');
  } finally {
    console.log('Cleaning up synthetic test rows...');
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.is_platform_query', 'true', true)`;
      await tx.webhookDelivery.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
    });
    console.log('Done.');
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nRLS verification FAILED:', err);
  process.exitCode = 1;
});
