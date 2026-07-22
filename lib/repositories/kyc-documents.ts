import { prisma } from '@/lib/db';

export interface KycDocument {
  id: string;
  organizationId: string;
  type: string;
  storageKey: string;
  reviewStatus: string;
  createdAt: Date;
}

export async function createKycDocument(
  organizationId: string,
  data: { type: string; storageKey: string }
): Promise<KycDocument> {
  return prisma.kycDocument.create({
    data: { organizationId, type: data.type, storageKey: data.storageKey },
  });
}

export async function listKycDocuments(organizationId: string): Promise<KycDocument[]> {
  return prisma.kycDocument.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listPendingKycDocuments(): Promise<
  (KycDocument & { organization: { id: string; businessName: string } })[]
> {
  return prisma.kycDocument.findMany({
    where: { reviewStatus: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: { organization: { select: { id: true, businessName: true } } },
  });
}

export async function updateKycDocumentReviewStatus(
  organizationId: string,
  documentId: string,
  reviewStatus: 'approved' | 'rejected'
): Promise<KycDocument> {
  // `where` includes organizationId even though `id` is already unique — this
  // is what makes the update inherently tenant-scoped rather than an accident
  // of a primary-key lookup, consistent with every other repository function.
  return prisma.kycDocument.update({
    where: { id: documentId, organizationId },
    data: { reviewStatus },
  });
}
