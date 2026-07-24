# Backup / Disaster-Recovery Restore Drill

PaySwift's primary datastore is Neon Postgres, which provides continuous
backups via **point-in-time recovery (PITR)** over a retention window (check
the current retention on the Neon project — the default on paid plans is 7
days; free/older projects may be shorter). This runbook is the drill you run
to prove that recovery actually works — do not assume a backup is good until
you've restored from it.

Run this drill **at least quarterly**, and after any change to the database
topology (new tables, the RLS work in Phase 4, the `app_runtime` role, etc.).

## RTO / RPO targets

- **RPO (max acceptable data loss): ~1 minute.** Neon PITR is continuous, so a
  restore can target any second within the retention window.
- **RTO (max acceptable downtime to recover): 1 hour.** Creating a Neon branch
  from a PITR timestamp is near-instant; the RTO budget covers verifying the
  branch, repointing `DATABASE_URL`/`DATABASE_APP_URL`, and redeploying.

## Drill procedure

1. **Pick a recovery target.** In the Neon console, choose a timestamp a few
   minutes in the past (within the retention window).

2. **Create a branch from that timestamp.** Neon → project → Branches →
   "Create branch" → "From a point in time" → select the timestamp. This gives
   an isolated copy of the database at that instant — it does NOT touch the
   production branch, so the drill is non-destructive.

3. **Get the branch's connection strings.** Copy both the owner
   (`neondb_owner`) connection string and — because RLS depends on it (Phase 4,
   Stage 3) — re-provision the restricted `app_runtime` role on the branch:
   ```
   DATABASE_URL="<branch owner connection string>" npx tsx scripts/create-app-runtime-role.ts
   ```
   Set the printed `DATABASE_APP_URL` for the drill environment.

4. **Verify migrations are all present on the branch:**
   ```
   DATABASE_URL="<branch owner connection string>" npx prisma migrate status
   ```
   Expect "Database schema is up to date" with every migration applied.

5. **Verify data integrity.** Against the branch, spot-check row counts and a
   few known records:
   ```
   DATABASE_URL="<branch owner>" npx prisma studio   # or a few SELECT counts
   ```
   Confirm the most recent transactions/payouts present at the recovery
   timestamp are there, and that RLS still enforces on the branch:
   ```
   DATABASE_APP_URL="<branch app_runtime>" npx tsx scripts/verify-rls.ts
   ```

6. **Record the result.** Note the drill date, the recovery target timestamp,
   how long steps 1–5 took (your measured RTO), and any issues, in your ops
   log / incident tracker.

7. **Clean up.** Delete the drill branch in the Neon console so it doesn't
   accrue cost or drift.

## Real recovery (not a drill)

The steps are the same through step 5, except in step 2 you restore to the
last-good timestamp *before* the incident, and in the cutover you repoint the
production `DATABASE_URL` / `DATABASE_APP_URL` (in Vercel and `.env.local`) at
the recovered branch and redeploy, then promote that branch to primary in
Neon. Follow the incident procedure in [`incident-response.md`](./incident-response.md)
for comms and severity handling.
