import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { randomBytes } from 'node:crypto';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * One-off provisioning script (Phase 4, Stage 3): creates a restricted
 * Postgres role for the running application to connect as, WITHOUT the
 * BYPASSRLS attribute — required because Neon's default `neondb_owner` role
 * has BYPASSRLS set, which makes Row-Level Security policies a no-op
 * regardless of ENABLE/FORCE ROW LEVEL SECURITY on the tables themselves
 * (confirmed via `SELECT rolbypassrls FROM pg_roles`).
 *
 * Run once as the owner role (DATABASE_URL). Prints the new role's
 * connection string once — set it as DATABASE_APP_URL (see lib/db.ts and
 * AGENTS.md) for the running app, and keep DATABASE_URL (owner) for
 * migrations only. Idempotent: safe to re-run, rotates the password each
 * time it does.
 *
 * Usage: npx tsx scripts/create-app-runtime-role.ts
 */

const ROLE_NAME = 'app_runtime';

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

  const ownerUrl = process.env.DATABASE_URL;
  if (!ownerUrl) throw new Error('DATABASE_URL is not set');

  const adapter = new PrismaNeon({ connectionString: ownerUrl });
  const prisma = new PrismaClient({ adapter });

  const password = randomBytes(24).toString('base64url');

  console.log(`Creating/rotating role "${ROLE_NAME}" (no BYPASSRLS, no CREATEDB, no CREATEROLE)...`);
  // CREATE ROLE can't be parameterized the same way DML can — the password is
  // generated server-side above (not user input), so this is not an
  // injection risk. Runs unconditionally to also cover the "rotate password
  // on re-run" case in one statement.
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${ROLE_NAME}') THEN
        CREATE ROLE ${ROLE_NAME} WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      ELSE
        ALTER ROLE ${ROLE_NAME} WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $$;
  `);

  console.log('Granting schema/table/sequence privileges (current + future)...');
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROLE_NAME};`);
  await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE_NAME};`);
  await prisma.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE_NAME};`);
  // Migrations run as the owner role and create future tables/sequences —
  // these defaults make sure app_runtime automatically gets access to them
  // without a manual follow-up grant after every future migration.
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROLE_NAME};`
  );
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ROLE_NAME};`
  );

  const verify = await prisma.$queryRaw<{ rolbypassrls: boolean; rolsuper: boolean }[]>`
    SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = ${ROLE_NAME}
  `;
  if (verify[0]?.rolbypassrls || verify[0]?.rolsuper) {
    throw new Error(`Role ${ROLE_NAME} unexpectedly has BYPASSRLS or SUPERUSER — refusing to print its connection string`);
  }
  console.log(`Verified: ${ROLE_NAME} has rolbypassrls=false, rolsuper=false.`);

  const url = new URL(ownerUrl);
  url.username = ROLE_NAME;
  url.password = password;

  console.log('\nDATABASE_APP_URL=' + url.toString());
  console.log(
    '\nSet the line above as DATABASE_APP_URL in .env.local and in Vercel\'s project environment variables.\nDATABASE_URL (owner) stays unchanged and is still used for migrations.'
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Role provisioning FAILED:', err);
  process.exitCode = 1;
});
