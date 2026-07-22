import path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { encryptSecret } from '../lib/crypto';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

function looksEncrypted(value: string | null): boolean {
  if (!value) return true; // Treat null as "doesn't need encryption"
  // Check if it matches base64:base64:base64
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // A simple heuristic for base64
  const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  return parts.every(p => base64Regex.test(p));
}

async function main() {
  console.log('Starting backfill for encrypting secrets...');

  const merchants = await prisma.merchant.findMany();
  let updatedCount = 0;

  for (const merchant of merchants) {
    const updateData: Record<string, string> = {};
    let needsUpdate = false;

    if (merchant.webhookSecret && !looksEncrypted(merchant.webhookSecret)) {
      updateData.webhookSecret = encryptSecret(merchant.webhookSecret);
      needsUpdate = true;
    }

    if (merchant.shopifyAdminAccessToken && !looksEncrypted(merchant.shopifyAdminAccessToken)) {
      updateData.shopifyAdminAccessToken = encryptSecret(merchant.shopifyAdminAccessToken);
      needsUpdate = true;
    }

    if (merchant.shopifyWebhookSecret && !looksEncrypted(merchant.shopifyWebhookSecret)) {
      updateData.shopifyWebhookSecret = encryptSecret(merchant.shopifyWebhookSecret);
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: updateData,
      });
      updatedCount++;
    }
  }

  console.log(`Backfill complete. Encrypted secrets for ${updatedCount} merchants.`);

  // Verify full coverage
  const unencrypted = await prisma.merchant.findMany();
  let missedCount = 0;
  for (const merchant of unencrypted) {
    if ((merchant.webhookSecret && !looksEncrypted(merchant.webhookSecret)) ||
        (merchant.shopifyAdminAccessToken && !looksEncrypted(merchant.shopifyAdminAccessToken)) ||
        (merchant.shopifyWebhookSecret && !looksEncrypted(merchant.shopifyWebhookSecret))) {
      missedCount++;
    }
  }

  if (missedCount === 0) {
    console.log('Verification passed: All merchant secrets are properly encrypted.');
  } else {
    console.error(`Verification failed: ${missedCount} merchants still have unencrypted secrets.`);
  }
}

main()
  .catch((e) => {
    console.error('Error running script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
