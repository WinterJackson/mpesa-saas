import { prisma } from '@/lib/db';
import { prismaReadonly } from '@/lib/db-readonly';

// Right-to-erasure requests (Phase 4, Stage 9). Deletion is NEVER
// auto-executed — a request is recorded for admin review, because financial
// record-retention obligations (AML/POCAMLA) conflict with blanket erasure.
// See CLAUDE.md's Phase 4 guardrails.

export async function createDeletionRequest(
  organizationId: string,
  requestedBy: string,
  reason?: string | null
) {
  return prisma.dataDeletionRequest.create({
    data: { organizationId, requestedBy, reason: reason ?? null },
  });
}

/** Org-scoped: a merchant sees only their own organization's requests. */
export async function listDeletionRequestsForOrganization(organizationId: string) {
  return prismaReadonly.dataDeletionRequest.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

/** Whether the org already has an unreviewed request (avoids duplicates). */
export async function hasPendingDeletionRequest(organizationId: string): Promise<boolean> {
  const existing = await prisma.dataDeletionRequest.findFirst({
    where: { organizationId, status: 'pending' },
    select: { id: true },
  });
  return existing !== null;
}

// ─── Admin (platform) — deliberately NOT org-scoped ─────────────────────────

export async function listAllDeletionRequests(status?: 'pending' | 'reviewed' | 'rejected') {
  return prismaReadonly.dataDeletionRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { organization: { select: { id: true, businessName: true } } },
  });
}

export async function reviewDeletionRequest(
  id: string,
  reviewedBy: string,
  status: 'reviewed' | 'rejected'
) {
  return prisma.dataDeletionRequest.update({
    where: { id },
    data: { status, reviewedBy, reviewedAt: new Date() },
  });
}
