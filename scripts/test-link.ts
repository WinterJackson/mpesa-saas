import { prisma } from '../lib/db';
import { createPaymentLink } from '../lib/repositories/payment-links';

async function main() {
  try {
    const merchant = await prisma.merchant.findFirst({ include: { organization: true } });
    if (!merchant) {
      console.log('No merchant found');
      return;
    }
    
    const link = await createPaymentLink({
      organizationId: merchant.organizationId,
      merchantId: merchant.id,
      title: 'Test Link',
      amountType: 'fixed',
      amount: 100,
      environment: merchant.environment,
    });
    console.log('Success:', link);
  } catch (error) {
    console.error('Error creating link:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
