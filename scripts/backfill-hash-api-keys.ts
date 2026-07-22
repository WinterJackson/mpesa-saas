import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

import path from 'path';

import { PrismaNeon } from '@prisma/adapter-neon';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

async function main() {
  console.log('Starting API key hash backfill...');

  try {
    // We use $queryRaw because the plaintext `key` column has been removed from 
    // the Prisma schema. If run against an older database state, this will explicitly
    // select the `key` column.
    const apiKeys = await prisma.$queryRaw<{ id: string; key: string; keyHash: string | null }[]>`
      SELECT id, key, "keyHash" FROM "ApiKey" 
      WHERE "keyHash" IS NULL OR "keyHash" = ''
    `;

    console.log(`Found ${apiKeys.length} API keys to process.`);

    let updatedCount = 0;

    for (const apiKey of apiKeys) {
      if (apiKey.key) {
        const keyHash = hashApiKey(apiKey.key);
        const keyPrefix = apiKey.key.slice(0, 12);

        await prisma.apiKey.update({
          where: { id: apiKey.id },
          data: {
            keyHash,
            keyPrefix,
          },
        });
        updatedCount++;
      }
    }

    console.log(`Successfully backfilled ${updatedCount} API keys.`);

    // Verify all keys have hashes using raw query since empty string is not assignable to string type natively in prisma where clause
    const countQuery = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "ApiKey" WHERE "keyHash" IS NULL OR "keyHash" = ''
    `;
    
    const countWithoutHash = Number(countQuery[0]?.count || 0);

    if (countWithoutHash === 0) {
      console.log('Verification passed: All API keys have hashes.');
    } else {
      console.error(`Verification failed: ${countWithoutHash} API keys still missing hashes.`);
    }

  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
