import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma, TransactionClient } from '@/lib/db';
import crypto from 'node:crypto';
import { generateApiKey } from '@/lib/api-keys';
import { encryptSecret } from '@/lib/crypto';
import { env } from '@/lib/env';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { seedPooledSandboxCredential } from '@/lib/repositories/daraja-credentials';
import { ensurePlansSeeded, getPlanByName, createTrialSubscription } from '@/lib/repositories/billing';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

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
    const { userId, orgId } = await auth();

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

    // Idempotency: Check if this Clerk user already belongs to an Organization
    const existingContext = await getOrganizationContext(userId, orgId);

    if (existingContext) {
      return NextResponse.json(
        { success: true, data: existingContext.merchant },
        { status: 200 }
      );
    }

    // 1. Create the Clerk Organization first — Clerk's API isn't part of the
    //    Postgres transaction below, so this happens outside it. If the local
    //    writes fail after this succeeds, the orphaned Clerk org is harmless
    //    (it just won't have a matching local row) and is safe to retry.
    const client = await clerkClient();
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

    // 3. Seed the pooled/PaySwift-managed sandbox Daraja credentials. This is
    //    the only place PaySwift's own MPESA_* env vars are read into a
    //    per-organization row — lib/daraja.ts never reads them directly.
    await seedPooledSandboxCredential(created.organization.id, {
      consumerKey: env.MPESA_CONSUMER_KEY,
      consumerSecret: env.MPESA_CONSUMER_SECRET,
      shortcode: env.MPESA_SHORTCODE,
      passkey: env.MPESA_PASSKEY,
      callbackUrl: env.MPESA_CALLBACK_URL,
    });

    // 4. Start the org on the Starter plan trial. ensurePlansSeeded() is
    //    idempotent (upsert by Plan.name), so this is safe to call on every
    //    signup rather than depending on a separate one-off seed step.
    await ensurePlansSeeded();
    const starterPlan = await getPlanByName('Starter');
    if (starterPlan) {
      await createTrialSubscription(created.organization.id, starterPlan.id);
    }

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
