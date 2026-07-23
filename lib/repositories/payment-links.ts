import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import type { Merchant } from '@prisma/client';

// Locally defined shapes (Prisma 7 + Neon adapter does not reliably export model
// types — same reason as lib/repositories/organizations.ts).

export interface PaymentLinkRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  amountType: string; // fixed | customer_set
  amount: number | null;
  active: boolean;
  environment: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface PaymentLinkWithStats extends PaymentLinkRow {
  paymentsCount: number;
  paymentsVolume: number;
}

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  amountType: true,
  amount: true,
  active: true,
  environment: true,
  expiresAt: true,
  createdAt: true,
} as const;

/** Cryptographically-random, URL-safe public slug (base64url, ~16 chars). */
function generateSlug(): string {
  return randomBytes(12).toString('base64url');
}

export async function createPaymentLink(params: {
  organizationId: string;
  merchantId: string;
  title: string;
  description?: string | null;
  amountType: 'fixed' | 'customer_set';
  amount?: number | null;
  environment: string;
  expiresAt?: Date | null;
}): Promise<PaymentLinkRow> {
  // Slug collisions are astronomically unlikely; retry a couple of times to be safe.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.paymentLink.create({
        data: {
          organizationId: params.organizationId,
          merchantId: params.merchantId,
          slug: generateSlug(),
          title: params.title,
          description: params.description ?? null,
          amountType: params.amountType,
          amount: params.amountType === 'fixed' ? params.amount ?? null : null,
          environment: params.environment,
          expiresAt: params.expiresAt ?? null,
        },
        select: LIST_SELECT,
      });
    } catch (err: unknown) {
      // P2002 = unique constraint (slug) — regenerate and retry.
      if (attempt < 2 && err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        continue;
      }
      throw err;
    }
  }
  // Unreachable in practice — the loop either returns or throws.
  throw new Error('Failed to generate a unique payment link slug');
}

/** Org-scoped list, newest first, with per-link completed-payment stats. */
export async function listPaymentLinks(
  organizationId: string,
  opts: { take?: number } = {}
): Promise<PaymentLinkWithStats[]> {
  const links = await prisma.paymentLink.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 100,
    select: {
      ...LIST_SELECT,
      transactions: {
        where: { status: 'completed' },
        select: { amount: true },
      },
    },
  });

  return links.map(({ transactions, ...link }) => ({
    ...link,
    paymentsCount: transactions.length,
    paymentsVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
  }));
}

export async function findPaymentLinkById(
  organizationId: string,
  id: string
): Promise<PaymentLinkRow | null> {
  return prisma.paymentLink.findFirst({
    where: { id, organizationId },
    select: LIST_SELECT,
  });
}

/** Org-scoped deactivation (idempotent). Returns null if not found in this org. */
export async function deactivatePaymentLink(
  organizationId: string,
  id: string
): Promise<PaymentLinkRow | null> {
  const existing = await prisma.paymentLink.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.paymentLink.update({
    where: { id },
    data: { active: false },
    select: LIST_SELECT,
  });
}

export interface ActivePaymentLink extends PaymentLinkRow {
  organizationId: string;
  merchant: Merchant;
  liveApprovedAt: Date | null;
}

/**
 * Deliberately UN-scoped lookup by public slug for the hosted checkout page
 * (/pay/[slug]) and its public initiate/status API. This is one of the small
 * number of documented non-tenant-scoped reads (like the C2B shortcode lookup)
 * — the slug itself is the capability. Returns null for missing, inactive, or
 * expired links so callers never have to re-check those. Includes the merchant
 * (needed by createAndInitiatePayment) and the org's liveApprovedAt (the
 * go-live gate) so a live link can be refused until the org is approved.
 */
export async function findActiveLinkBySlug(slug: string): Promise<ActivePaymentLink | null> {
  const link = await prisma.paymentLink.findFirst({
    where: {
      slug,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      ...LIST_SELECT,
      organizationId: true,
      merchant: true,
      organization: { select: { liveApprovedAt: true } },
    },
  });

  if (!link) return null;

  const { organization, ...rest } = link;
  return { ...rest, liveApprovedAt: organization.liveApprovedAt };
}
