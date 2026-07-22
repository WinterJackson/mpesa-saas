import { prisma } from '@/lib/db';

export interface AuditLogEntry {
  organizationId?: string | null;
  actorId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditLogEntry) {
  return prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId ?? null,
      actorId: entry.actorId,
      action: entry.action,
      metadata: entry.metadata as never,
    },
  });
}

export async function listAuditLogsForOrganization(organizationId: string, take = 50) {
  return prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function listAllAuditLogs(take = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: { organization: { select: { id: true, businessName: true } } },
  });
}
