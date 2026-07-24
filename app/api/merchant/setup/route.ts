import { NextResponse, after } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { notifyWelcome } from '@/lib/email/notifications';
import { prisma, TransactionClient } from '@/lib/db';
import crypto from 'node:crypto';
import { generateApiKey } from '@/lib/api-keys';
import { encryptSecret } from '@/lib/crypto';
import { env } from '@/lib/env';
import { seedPooledSandboxCredential } from '@/lib/repositories/daraja-credentials';
import { ensurePlansSeeded, getPlanByName, ensureTrialSubscription } from '@/lib/repositories/billing';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * Ensures the post-transaction onboarding steps are complete for an organization:
 * pooled-sandbox Daraja credentials + a Starter trial subscription. Both are
 * idempotent, so this both provisions a fresh org and self-heals a partially
 * onboarded one (e.g. a prior attempt that failed after the DB transaction).
 */
async function ensureOnboardingProvisioned(organizationId: string) {
  await seedPooledSandboxCredential(organizationId, {
    consumerKey: env.MPESA_CONSUMER_KEY,
    consumerSecret: env.MPESA_CONSUMER_SECRET,
    shortcode: env.MPESA_SHORTCODE,
    passkey: env.MPESA_PASSKEY,
    callbackUrl: env.MPESA_CALLBACK_URL,
  });

  await ensurePlansSeeded();
  const starterPlan = await getPlanByName('Starter');
  if (starterPlan) {
    await ensureTrialSubscription(organizationId, starterPlan.id);
  }
}

/**
 * POST /api/merchant/setup
 *
 * Called during onboarding to provision a Clerk Organization + local
 * Organization/Membership/Merchant/initial API key, and to seed the new
 * organization's pooled-sandbox Daraja credentials (master plan Section 16.2
 * — this is what lets a brand-new signup send a real sandbox STK push
 * same-day without owning a Safaricom account).
 *
 * Auth: Clerk session (userId)
 * Idempotent: If the caller already belongs to an Organization, returns it.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const businessName = body.businessName;

    if (!businessName || typeof businessName !== 'string' || businessName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Business name is required and must be at least 2 characters long' },
        { status: 400 }
      );
    }

    const client = await clerkClient();

    // Idempotency by IDENTITY: clerkUserId is unique on Merchant, so this catches
    // an already-onboarded user regardless of the active Clerk org (getOrgContext
    // keyed on the active orgId could miss and cause a duplicate-create crash).
    // If a prior attempt left the org partially provisioned (e.g. it failed after
    // the DB transaction but before seeding credentials), self-heal and finish.
    const existingMerchant = await prisma.merchant.findUnique({
      where: { clerkUserId: userId },
    });

    if (existingMerchant?.organizationId) {
      await ensureOnboardingProvisioned(existingMerchant.organizationId);
      await client.users.updateUserMetadata(userId, { publicMetadata: { onboarded: true } });

      const healed = NextResponse.json({ success: true, data: existingMerchant }, { status: 200 });
      healed.cookies.set('payswift_just_onboarded', '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60,
        path: '/',
      });
      return healed;
    }

    // 1. Create the Clerk Organization first — Clerk's API isn't part of the
    //    Postgres transaction below, so this happens outside it. If the local
    //    writes fail after this succeeds, the orphaned Clerk org is harmless
    //    (it just won't have a matching local row) and is safe to retry.
    const clerkOrg = await client.organizations.createOrganization({
      name: businessName.trim(),
      createdBy: userId,
    });

    // 2. Create Organization + Membership(owner) + Merchant + initial API key atomically
    const created = await prisma.$transaction(async (tx: TransactionClient) => {
      const organization = await tx.organization.create({
        data: {
          clerkOrgId: clerkOrg.id,
          businessName: businessName.trim(),
          environment: 'sandbox',
          kycStatus: 'pending',
        },
      });

      await tx.membership.create({
        data: {
          organizationId: organization.id,
          clerkUserId: userId,
          role: 'owner',
        },
      });

      const rawWebhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
      const merchant = await tx.merchant.create({
        data: {
          clerkUserId: userId,
          organizationId: organization.id,
          businessName: businessName.trim(),
          environment: 'sandbox',
          webhookSecret: encryptSecret(rawWebhookSecret),
        },
      });

      const newKey = generateApiKey();
      const apiKey = await tx.apiKey.create({
        data: {
          merchantId: merchant.id,
          organizationId: organization.id,
          keyHash: newKey.keyHash,
          keyPrefix: newKey.keyPrefix,
        },
      });

      return {
        organization,
        merchant: {
          ...merchant,
          webhookSecret: rawWebhookSecret,
          apiKeyRaw: newKey.raw,
          apiKeys: [apiKey],
        },
      };
    });

    // 3. Seed pooled sandbox Daraja credentials + start the Starter trial
    //    (idempotent; also the self-heal path for a partial retry).
    await ensureOnboardingProvisioned(created.organization.id);

    const newMerchant = created.merchant;

    await writeAuditLog({
      organizationId: created.organization.id,
      actorId: userId,
      action: 'organization.created',
      metadata: { businessName: businessName.trim() },
    });

    // Update Clerk metadata so edge middleware knows user is onboarded
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboarded: true },
    });

    // Business onboarding email (fire-and-forget; not a Clerk auth email).
    after(() => notifyWelcome(created.organization.id));

    const response = NextResponse.json(
      { success: true, data: newMerchant },
      { status: 201 }
    );
    response.cookies.set('payswift_just_onboarded', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60,
      path: '/',
    });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Merchant Setup Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error during merchant setup' },
      { status: 500 }
    );
  }
}
