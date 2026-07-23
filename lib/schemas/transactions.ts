import { z } from 'zod';
import { successResponse } from './common';

/** A transaction as returned by the public list/detail endpoints. */
export const transactionResourceSchema = z
  .object({
    id: z.string(),
    amount: z.number(),
    phone: z.string(),
    status: z.string(),
    orderReference: z.string().nullable(),
    environment: z.string(),
    source: z.string(),
    mpesaReceipt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'Transaction' });

export const transactionListDataSchema = z
  .object({
    transactions: z.array(transactionResourceSchema),
    nextCursor: z.string().nullable(),
  })
  .meta({ id: 'TransactionListData' });

export const transactionListResponseSchema = successResponse(transactionListDataSchema);
