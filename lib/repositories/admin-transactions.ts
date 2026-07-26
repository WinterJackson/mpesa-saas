import { prismaReadonly } from '@/lib/db-readonly';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { Prisma } from '@prisma/client';

export interface AdminTransactionQuery {
  phone?: string;
  mpesaReceipt?: string;
  organizationName?: string;
  transactionId?: string;
  take?: number;
}

export async function adminSearchTransactions(query: AdminTransactionQuery, adminUserId: string) {
  // 1. Audit log the search action (mandated for cross-tenant data access)
  await writeAuditLog({
    actorId: adminUserId,
    action: 'admin.transaction_search',
    metadata: { query: JSON.parse(JSON.stringify(query)) },
  });

  // 2. Build the where clause efficiently
  const where: Prisma.TransactionWhereInput = {};

  if (query.transactionId) {
    where.id = query.transactionId;
  }
  if (query.mpesaReceipt) {
    where.mpesaReceipt = { equals: query.mpesaReceipt, mode: 'insensitive' };
  }
  if (query.phone) {
    where.phone = { contains: query.phone };
  }
  if (query.organizationName) {
    where.organization = {
      businessName: { contains: query.organizationName, mode: 'insensitive' },
    };
  }

  // 3. Execute query on the readonly replica (if configured)
  const limit = Math.min(query.take ?? 50, 100);

  const transactions = await prismaReadonly.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      amount: true,
      phone: true,
      status: true,
      mpesaReceipt: true,
      createdAt: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          businessName: true,
        },
      },
    },
  });

  return transactions;
}
