import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local for database connection
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill for missing webhook secrets...');

  const merchants = await prisma.merchant.findMany({
    where: {
      webhookSecret: null,
    },
  });

  if (merchants.length === 0) {
    console.log('No merchants found needing a webhook secret backfill.');
    return;
  }

  console.log(`Found ${merchants.length} merchants missing a webhook secret.`);

  for (const merchant of merchants) {
    const newSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { webhookSecret: newSecret },
    });
    console.log(`Updated merchant ${merchant.id} with new webhook secret.`);
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error('Error running script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
