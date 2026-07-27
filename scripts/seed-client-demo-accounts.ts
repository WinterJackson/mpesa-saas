import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { createClerkClient } from '@clerk/nextjs/server';
import * as dotenv from 'dotenv';
import path from 'path';
import { encryptSecret } from '../lib/crypto';
import { ensurePlansSeeded, ensureTrialSubscription, getPlanByName } from '../lib/repositories/billing';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_APP_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const PASSWORD = 'ClientDemo2026!';
const ORG_NAME = 'Client Demo Organization';

const MERCHANT_ROLES = ['owner', 'admin', 'developer', 'finance'] as const;
const ADMIN_ROLES = ['support', 'kyc_reviewer', 'finance', 'ops', 'superadmin'] as const;

type MerchantRole = typeof MERCHANT_ROLES[number];
type AdminRole = typeof ADMIN_ROLES[number];

const merchantEmails: Record<MerchantRole, string> = {
  owner: 'owner+clerk_test@payswift.co.ke',
  admin: 'admin+clerk_test@payswift.co.ke',
  developer: 'developer+clerk_test@payswift.co.ke',
  finance: 'merchant-finance+clerk_test@payswift.co.ke',
};

const adminEmails: Record<AdminRole, string> = {
  support: 'support+clerk_test@payswift.co.ke',
  kyc_reviewer: 'kyc-reviewer+clerk_test@payswift.co.ke',
  finance: 'admin-finance+clerk_test@payswift.co.ke',
  ops: 'ops+clerk_test@payswift.co.ke',
  superadmin: 'superadmin+clerk_test@payswift.co.ke',
};

async function getOrCreateClerkUser(email: string, client: ReturnType<typeof createClerkClient>) {
  const users = await client.users.getUserList({ emailAddress: [email] });
  if (users.data.length > 0) {
    // Delete existing user for idempotency to ensure clean state
    await client.users.deleteUser(users.data[0].id);
  }
  return client.users.createUser({
    emailAddress: [email],
    password: PASSWORD,
    skipPasswordChecks: true,
  });
}

async function main() {
  const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  console.log('🌱 Starting client demo accounts provisioning...');
  console.log(`📡 Connecting to database target: ${new URL(connectionString!).hostname}`);
  // 1. Provision Merchant Accounts
  console.log('\n--- Provisioning Merchant Accounts ---');
  let clerkOrgId: string | null = null;
  let dbOrgId: string | null = null;

  for (const role of MERCHANT_ROLES) {
    const email = merchantEmails[role];
    console.log(`Creating merchant user: ${email} (${role})...`);
    const user = await getOrCreateClerkUser(email, client);

    if (role === 'owner') {
      // The owner creates the org
      const clerkOrg = await client.organizations.createOrganization({
        name: ORG_NAME,
        createdBy: user.id,
      });
      clerkOrgId = clerkOrg.id;

      // Clean up existing local org if re-running
      const existingOrg = await prisma.organization.findFirst({ where: { businessName: ORG_NAME } });
      if (existingOrg) {
        try {
          await client.organizations.deleteOrganization(existingOrg.clerkOrgId);
        } catch {
          // Ignore if it doesn't exist in Clerk anymore
        }

        const orgId = existingOrg.id;
        
        // Manual Cascade Delete (19 tables, from leaves to root)
        await prisma.refund.deleteMany({ where: { organizationId: orgId } });
        await prisma.payout.deleteMany({ where: { organizationId: orgId } });
        await prisma.transaction.deleteMany({ where: { organizationId: orgId } });
        await prisma.paymentLink.deleteMany({ where: { organizationId: orgId } });
        
        await prisma.webhookDelivery.deleteMany({ where: { organizationId: orgId } });
        await prisma.apiKey.deleteMany({ where: { organizationId: orgId } });
        await prisma.idempotencyRecord.deleteMany({ where: { organizationId: orgId } });
        await prisma.reconciliationMismatch.deleteMany({ where: { organizationId: orgId } });
        await prisma.accountBalanceSnapshot.deleteMany({ where: { organizationId: orgId } });
        await prisma.darajaCommand.deleteMany({ where: { organizationId: orgId } });
        
        await prisma.subscription.deleteMany({ where: { organizationId: orgId } });
        await prisma.notificationPreference.deleteMany({ where: { organizationId: orgId } });
        await prisma.notification.deleteMany({ where: { organizationId: orgId } });
        await prisma.dataDeletionRequest.deleteMany({ where: { organizationId: orgId } });
        await prisma.kycDocument.deleteMany({ where: { organizationId: orgId } });
        await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
        await prisma.adminAlert.deleteMany({ where: { organizationId: orgId } });
        
        await prisma.organizationDarajaCredential.deleteMany({ where: { organizationId: orgId } });
        await prisma.membership.deleteMany({ where: { organizationId: orgId } });
        await prisma.merchant.deleteMany({ where: { organizationId: orgId } });
        
        // Finally, delete the organization
        await prisma.organization.delete({ where: { id: orgId } });
      }

      const organization = await prisma.organization.create({
        data: {
          clerkOrgId: clerkOrg.id,
          businessName: ORG_NAME,
          environment: 'sandbox',
          kycStatus: 'approved',
        },
      });
      dbOrgId = organization.id;

      await prisma.merchant.create({
        data: {
          clerkUserId: user.id,
          organizationId: organization.id,
          businessName: ORG_NAME,
          environment: 'sandbox',
        },
      });

      // Provide sandbox credentials so it's fully unlocked
      await prisma.organizationDarajaCredential.create({
        data: {
          organizationId: organization.id,
          consumerKeyEncrypted: encryptSecret(process.env.MPESA_CONSUMER_KEY || 'demo_key'),
          consumerSecretEncrypted: encryptSecret(process.env.MPESA_CONSUMER_SECRET || 'demo_secret'),
          shortcode: process.env.MPESA_SHORTCODE || '174379',
          passkeyEncrypted: encryptSecret(process.env.MPESA_PASSKEY || 'demo_passkey'),
          callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://demo.example.com/callback',
          isPooledSandbox: true,
        },
      });

      // Grant them a trial plan so the dashboard billing alerts don't show "No Plan"
      await ensurePlansSeeded();
      const plan = await getPlanByName('Growth');
      if (plan) {
        await ensureTrialSubscription(organization.id, plan.id);
      }
    } else {
      // Add other roles to the Clerk organization
      if (clerkOrgId) {
        await client.organizations.createOrganizationMembership({
          organizationId: clerkOrgId,
          userId: user.id,
          role: 'org:member',
        });
      }
    }

    // Add to our local Membership table
    if (dbOrgId) {
      await prisma.membership.upsert({
        where: { organizationId_clerkUserId: { organizationId: dbOrgId, clerkUserId: user.id } },
        update: { role },
        create: { organizationId: dbOrgId, clerkUserId: user.id, role },
      });
    }
  }

  // 2. Provision Admin Accounts
  console.log('\n--- Provisioning Admin Accounts ---');
  for (const role of ADMIN_ROLES) {
    const email = adminEmails[role];
    console.log(`Creating admin user: ${email} (${role})...`);
    const user = await getOrCreateClerkUser(email, client);

    const existingAdmin = await prisma.adminUser.findFirst({ where: { email } });
    if (existingAdmin) {
      await prisma.adminUser.delete({ where: { id: existingAdmin.id } });
    }

    await prisma.adminUser.create({
      data: {
        clerkUserId: user.id,
        role,
        email,
        status: 'active',
        createdBy: 'client-demo-script',
      },
    });
  }

  console.log('\n✅ Successfully seeded client demo accounts!');
  console.log('====================================================');
  console.log(' PASSWORD FOR ALL ACCOUNTS:', PASSWORD);
  console.log('====================================================');
  console.log(' MERCHANT ROLES (Login at /sign-in, lands in /dashboard):');
  MERCHANT_ROLES.forEach(r => console.log(`   - ${r.padEnd(15)}: ${merchantEmails[r]}`));
  console.log('\n ADMIN ROLES (Login at /sign-in, lands in /admin):');
  ADMIN_ROLES.forEach(r => console.log(`   - ${r.padEnd(15)}: ${adminEmails[r]}`));
  console.log('====================================================');
  console.log('You can now share these credentials with your client.');
}

main()
  .catch((e) => {
    console.error('❌ Error running script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
