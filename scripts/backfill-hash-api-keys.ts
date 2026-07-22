/**
 * DEPRECATED / INOPERABLE
 * 
 * This script was originally intended to backfill `keyHash` and `keyPrefix` for existing
 * API keys when transitioning away from plaintext `key` storage.
 * 
 * However, the database schema was synchronized using `prisma db push` before an additive
 * migration was applied, resulting in the immediate and unrecoverable drop of the `key` column
 * from the live database. (See Phase 0 Remediation / Task 2).
 * 
 * The migration history has been reconciled (see 20260722114600_reconcile_api_key_hash_schema),
 * but this backfill script cannot run because the source plaintext data is gone. Any API keys
 * created before this event must be regenerated manually by merchants.
 */

async function main() {
  console.log('Skipping backfill: The plaintext `key` column has already been dropped from the live database.');
  console.log('Any API keys generated prior to this fix are unrecoverable and must be regenerated.');
}

main().catch(console.error);
