import { PrismaClient } from '@prisma/client';
import { clerkClient } from '@clerk/nextjs/server';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Imported after dotenv.config() so ENCRYPTION_KEY is already on process.env
// by the time lib/crypto.ts's getKey() reads it.
import { encryptSecret } from '../lib/crypto';

const prisma = new PrismaClient();

// Fixed, clearly-labeled identifiers so this script is idempotent — re-running
// it finds and reuses the same QA organization rather than creating a new one
// each time. Intended for Playwright/CI use (master plan Section 16, layer 6),
// not for demo-store traffic (see app/api/demo/seed/route.ts for that).
const QA_CLERK_USER_ID = 'qa_e2e_user';
const QA_BUSINESS_NAME = 'PaySwift QA Organization';

/**
 * One-off / idempotent script: provisions a permanent internal Organization
 * (with pooled sandbox Daraja credentials) for Playwright E2E runs, so tests
 * that need an already-onboarded organization don't have to create a fresh
 * Clerk user and walk the onboarding wizard on every run.
 *
 * Requires MPESA_CONSUMER_KEY/MPESA_CONSUMER_SECRET/MPESA_SHORTCODE/
 * MPESA_PASSKEY/MPESA_CALLBACK_URL to be set, same as any other onboarding.
 */
async function main() {
  const existing = await prisma.merchant.findUnique({
    where: { clerkUserId: QA_CLERK_USER_ID },
    include: { organization: true, apiKeys: { where: { revoked: false } } },
  });

  if (existing) {
    console.log(`QA organization already exists: ${existing.organization?.id} (Merchant ${existing.id}).`);
    console.log('Re-run scripts/seed-transactions.ts if you also want fixture transactions.');
    return;
  }

  console.log('Creating QA organization...');

  const client = await clerkClient();
  const clerkOrg = await client.organizations.createOrganization({
    name: QA_BUSINESS_NAME,
    createdBy: QA_CLERK_USER_ID,
  });

  const organization = await prisma.organization.create({
    data: {
      clerkOrgId: clerkOrg.id,
      businessName: QA_BUSINESS_NAME,
      environment: 'sandbox',
      kycStatus: 'approved',
    },
  });

  await prisma.membership.create({
    data: { organizationId: organization.id, clerkUserId: QA_CLERK_USER_ID, role: 'owner' },
  });

  const merchant = await prisma.merchant.create({
    data: {
      clerkUserId: QA_CLERK_USER_ID,
      organizationId: organization.id,
      businessName: QA_BUSINESS_NAME,
      environment: 'sandbox',
    },
  });

  await prisma.organizationDarajaCredential.create({
    data: {
      organizationId: organization.id,
      consumerKeyEncrypted: encryptSecret(process.env.MPESA_CONSUMER_KEY!),
      consumerSecretEncrypted: encryptSecret(process.env.MPESA_CONSUMER_SECRET!),
      shortcode: process.env.MPESA_SHORTCODE!,
      passkeyEncrypted: encryptSecret(process.env.MPESA_PASSKEY!),
      callbackUrl: process.env.MPESA_CALLBACK_URL!,
      isPooledSandbox: true,
    },
  });

  console.log(`Created QA organization ${organization.id} (Clerk org ${clerkOrg.id}, Merchant ${merchant.id}).`);
}

main()
  .catch((e) => {
    console.error('Error running script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
