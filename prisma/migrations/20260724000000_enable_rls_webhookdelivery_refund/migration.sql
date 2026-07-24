-- Row-Level Security (Phase 4, Stage 3): defense-in-depth tenant isolation
-- BEHIND the existing lib/repositories/* application-level scoping, not a
-- replacement for it. Every repository function must still take
-- organizationId and filter by it explicitly.
--
-- FORCE ROW LEVEL SECURITY is required in addition to ENABLE: Postgres table
-- owners (the role this app connects as) bypass RLS by default unless the
-- table is explicitly forced.
--
-- Every query against these tables must now run inside a transaction that
-- has first called either
--   SELECT set_config('app.current_org_id', '<organizationId>', true)
-- or
--   SELECT set_config('app.is_platform_query', 'true', true)
-- (see lib/db.ts's withTenantContext / withPlatformContext). A query with
-- neither set will return zero rows for SELECT (current_setting(..., true)
-- is NULL when unset, and NULL never equals a real organizationId) and will
-- be rejected for INSERT/UPDATE/DELETE.
--
-- Scope: only the two tables below. Every current call site for both
-- (grepped across app/ and lib/, outside their own test files) has been
-- confirmed to already route through lib/repositories/webhook-deliveries.ts
-- and lib/repositories/refunds.ts respectively — no other file queries them
-- directly. Transaction, ApiKey, and other tenant-scoped tables are NOT yet
-- covered; several of their current call sites bypass lib/repositories/*
-- entirely (a pre-existing guardrail gap, tracked separately in CLAUDE.md),
-- and enabling FORCE ROW LEVEL SECURITY on them before that's fixed would
-- silently break those call sites. Extend table-by-table, following the same
-- audit-then-migrate discipline as this migration.

ALTER TABLE "WebhookDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookDelivery" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WebhookDelivery"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_query', true) = 'true'
  );

ALTER TABLE "Refund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Refund" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Refund"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_query', true) = 'true'
  );
