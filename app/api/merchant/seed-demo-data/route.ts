import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { seedDemoTransactions } from '@/lib/repositories/transactions';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the acting org via getOrganizationContext (NEVER Merchant.clerkUserId
    // alone — guardrail #6), so any authorized teammate can seed demo data for
    // their org, not just the original owner.
    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin', 'developer']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    const result = await seedDemoTransactions({
      organizationId: context.organization.id,
      merchantId: context.merchant.id,
      environment: context.merchant.environment,
    });

    if ('alreadySeeded' in result) {
      return NextResponse.json(
        { success: false, error: 'Demo data already seeded for this account.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: `Seeded ${result.seeded} sample transactions.` },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Seed Demo Data Error]:', message);
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Seed data collision — please try again.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
