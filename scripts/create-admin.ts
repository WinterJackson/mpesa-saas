import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * Bootstrap / provisioning script for PLATFORM ADMIN accounts (AdminUser table).
 *
 * WHY THIS EXISTS: the admin-console API that grants admin access is itself
 * gated on the `admin:manage` capability (superadmin) — so a fresh deployment
 * with zero admins has a chicken-and-egg problem: nobody can create the FIRST
 * admin through the app. This one-off script breaks that cycle by inserting the
 * first superadmin directly. After that, further admins are managed from
 * /admin/admins in the console (or re-run this script).
 *
 * The person MUST already have a Clerk account (they sign up / sign in normally
 * first); pass their Clerk user id (looks like `user_xxx`, visible in the Clerk
 * Dashboard). Idempotent: re-running updates the role/email of an existing row.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <clerkUserId> [role] [email] [displayName]
 * Examples:
 *   npx tsx scripts/create-admin.ts user_2abc123                     # superadmin
 *   npx tsx scripts/create-admin.ts user_2abc123 ops ops@payswift.co.ke "Ops Lead"
 */

const VALID_ROLES = ['support', 'kyc_reviewer', 'finance', 'ops', 'superadmin'];

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

  const [clerkUserId, roleArg, email, displayName] = process.argv.slice(2);

  if (!clerkUserId || !clerkUserId.startsWith('user_')) {
    throw new Error(
      'First argument must be a Clerk user id (e.g. user_2abc...). ' +
        'Find it in the Clerk Dashboard for the person you are granting admin access.'
    );
  }

  const role = roleArg ?? 'superadmin';
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`role must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_APP_URL;
  if (!connectionString) throw new Error('DATABASE_URL (or DATABASE_APP_URL) is not set');

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const admin = await prisma.adminUser.upsert({
      where: { clerkUserId },
      update: { role, ...(email ? { email } : {}), ...(displayName ? { displayName } : {}), status: 'active' },
      create: {
        clerkUserId,
        role,
        email: email ?? null,
        displayName: displayName ?? null,
        createdBy: 'bootstrap-script',
      },
    });

    console.log(`✅ Admin account ready: ${admin.clerkUserId} → role "${admin.role}" (status: ${admin.status})`);
    console.log('   They can now open /admin after signing in to PaySwift.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Failed to create admin:', err instanceof Error ? err.message : err);
  process.exit(1);
});
