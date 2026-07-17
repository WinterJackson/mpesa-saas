import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { prisma } from '../lib/db';

async function main() {
  const merchant = await prisma.merchant.findFirst();
  if (!merchant) {
    console.error('No merchant found in the database. Run the onboarding flow first.');
    process.exit(1);
  }

  console.log(`Seeding for merchant: ${merchant.businessName} (${merchant.id})`);

  const seedData = [
    {
      merchantId: merchant.id,
      amount: 1500,
      phone: '254712345678',
      orderReference: 'ORD-77A9B1',
      status: 'completed',
      checkoutRequestId: 'ws_CO_160720261623456781',
      mpesaReceipt: 'QEG12A3B4C',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
    },
    {
      merchantId: merchant.id,
      amount: 250,
      phone: '254798765432',
      orderReference: 'ORD-88B9C2',
      status: 'pending',
      checkoutRequestId: 'ws_CO_160720261625456782',
      mpesaReceipt: null,
      resultCode: null,
      resultDesc: null,
    },
    {
      merchantId: merchant.id,
      amount: 8000,
      phone: '254700112233',
      orderReference: 'ORD-99C9D3',
      status: 'cancelled',
      checkoutRequestId: 'ws_CO_160720261627456783',
      mpesaReceipt: null,
      resultCode: 1032,
      resultDesc: 'Request cancelled by user',
    },
    {
      merchantId: merchant.id,
      amount: 3200,
      phone: '254744556677',
      orderReference: 'ORD-11D9E4',
      status: 'completed',
      checkoutRequestId: 'ws_CO_160720261629456784',
      mpesaReceipt: 'QEG98Z7Y6X',
      resultCode: 0,
      resultDesc: 'The service request is processed successfully.',
    },
    {
      merchantId: merchant.id,
      amount: 500,
      phone: '254799887766',
      orderReference: 'ORD-22E9F5',
      status: 'failed',
      checkoutRequestId: 'ws_CO_160720261631456785',
      mpesaReceipt: null,
      resultCode: 1,
      resultDesc: 'Insufficient funds',
    }
  ];

  await prisma.transaction.createMany({
    data: seedData
  });

  console.log('Seeded 5 transactions successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
