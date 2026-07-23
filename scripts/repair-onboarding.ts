import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';
import { encryptSecret } from '../lib/crypto';

// Non-destructive repair: completes onboarding for every existing Merchant whose
// provisioning is incomplete — seeds pooled sandbox Daraja credentials, ensures a
// Starter trial subscription, and sets the Clerk user's publicMetadata.onboarded.
// Fixes both (a) merchants left partial by a failed onboarding attempt and
// (b) the Phase-1-backfilled orgs, which were never given sandbox credentials.
// Only ADDS missing rows/flags — never overwrites or deletes.

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const TRIAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

async function main() {
  console.log('Repairing incomplete onboarding for existing merchants...\n');

  // Ensure the placeholder plans exist (idempotent).
  for (const plan of [
    { name: 'Starter', monthlyFee: 0, txFeeBps: 150, txCapMonthly: 200 },
    { name: 'Growth', monthlyFee: 5000, txFeeBps: 100, txCapMonthly: null },
  ]) {
    await prisma.plan.upsert({ where: { name: plan.name }, update: {}, create: plan });
  }
  const starter = await prisma.plan.findUnique({ where: { name: 'Starter' } });

  // organizationId is NOT NULL, so every merchant has an organization.
  const merchants = await prisma.merchant.findMany();
  console.log(`Found ${merchants.length} merchant(s).\n`);

  const sandbox = {
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    shortcode: process.env.MPESA_SHORTCODE!,
    passkey: process.env.MPESA_PASSKEY!,
    callbackUrl: process.env.MPESA_CALLBACK_URL!,
  };

  for (const merchant of merchants) {
    const organizationId = merchant.organizationId!;
    const actions: string[] = [];

    // 1. Pooled sandbox credentials (only if missing).
    const cred = await prisma.organizationDarajaCredential.findUnique({ where: { organizationId }, select: { id: true } });
    if (!cred) {
      await prisma.organizationDarajaCredential.create({
        data: {
          organizationId,
          consumerKeyEncrypted: encryptSecret(sandbox.consumerKey),
          consumerSecretEncrypted: encryptSecret(sandbox.consumerSecret),
          shortcode: sandbox.shortcode,
          passkeyEncrypted: encryptSecret(sandbox.passkey),
          callbackUrl: sandbox.callbackUrl,
          isPooledSandbox: true,
        },
      });
      actions.push('seeded sandbox credentials');
    }

    // 2. Starter trial subscription (only if missing).
    if (starter) {
      const sub = await prisma.subscription.findUnique({ where: { organizationId }, select: { id: true } });
      if (!sub) {
        await prisma.subscription.create({
          data: { organizationId, planId: starter.id, status: 'active', currentPeriodEnd: new Date(Date.now() + TRIAL_PERIOD_MS) },
        });
        actions.push('created trial subscription');
      }
    }

    // 3. Clerk onboarded flag (real Clerk users only; skip synthetic like demo_user_123).
    if (merchant.clerkUserId.startsWith('user_')) {
      try {
        await clerk.users.updateUserMetadata(merchant.clerkUserId, { publicMetadata: { onboarded: true } });
        actions.push('set onboarded=true');
      } catch (e: unknown) {
        actions.push(`FAILED to set onboarded (${e instanceof Error ? e.message : 'unknown'})`);
      }
    }

    console.log(`- ${merchant.businessName} (${merchant.clerkUserId}): ${actions.length ? actions.join(', ') : 'already complete'}`);
  }

  console.log('\nRepair complete.');
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
