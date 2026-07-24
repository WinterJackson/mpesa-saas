import * as Sentry from '@sentry/nextjs';

/**
 * Wraps an outbound Daraja API call or webhook delivery in a Sentry span so
 * latency and failures are traceable per-organization in Sentry's
 * performance view (Phase 4, Stage 4) — no new vendor, since Sentry's
 * tracing is already OpenTelemetry-based under the hood.
 *
 * Tags ONLY organizationId — never phone numbers, credentials, or other PII.
 * If the wrapped function throws, the span is marked as errored and the
 * error still propagates to the caller unchanged.
 */
export function withApiSpan<T>(
  name: string,
  op: string,
  organizationId: string | null | undefined,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op,
      attributes: organizationId ? { 'payswift.organization_id': organizationId } : {},
    },
    () => fn()
  );
}
