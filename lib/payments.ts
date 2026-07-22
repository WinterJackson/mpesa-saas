import { initiateSTKPush } from '@/lib/daraja';
import { prisma } from '@/lib/db';
import type { Merchant, Transaction } from '@prisma/client';

export type InitiatePaymentResult = 
  | { success: true; transaction: Transaction; checkoutRequestId: string; merchantRequestID: string; customerMessage: string }
  | { success: false; error: string; transaction?: Transaction };

export async function createAndInitiatePayment(params: {
  merchant: Merchant;
  organizationId: string;
  phone: string;
  amount: number;
  orderReference: string | null;
  source: string;
}): Promise<InitiatePaymentResult> {
  const { merchant, organizationId, phone, amount, orderReference, source } = params;

  // 1. Create Pending Transaction
  const transaction = await prisma.transaction.create({
    data: {
      merchantId: merchant.id,
      organizationId,
      phone,
      amount,
      orderReference,
      status: 'pending',
      environment: merchant.environment,
      source,
    },
  });

  // 2. Initiate STK Push via Daraja
  try {
    const darajaResponse = await initiateSTKPush({
      organizationId,
      phone,
      amount,
      accountReference: merchant.businessName.substring(0, 12),
      transactionDesc: orderReference
        ? `Pay ${String(orderReference).substring(0, 8)}`
        : 'Payment',
      environment: merchant.environment as 'sandbox' | 'live',
    });

    // 3. Update Transaction with CheckoutRequestID
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        checkoutRequestId: darajaResponse.CheckoutRequestID,
      },
    });

    return {
      success: true,
      transaction: updatedTransaction,
      checkoutRequestId: darajaResponse.CheckoutRequestID,
      merchantRequestID: darajaResponse.MerchantRequestID,
      customerMessage: darajaResponse.CustomerMessage,
    };
  } catch (darajaError: unknown) {
    // 4. Handle Daraja Failure
    const errorMessage = darajaError instanceof Error
      ? darajaError.message
      : 'Payment gateway failed';

    const failedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'failed',
        resultDesc: errorMessage,
      },
    });

    return {
      success: false,
      error: errorMessage,
      transaction: failedTransaction,
    };
  }
}
