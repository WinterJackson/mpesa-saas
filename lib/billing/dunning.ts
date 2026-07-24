// Dunning policy (Stage D) — the PURE decision layer for retrying failed
// subscription charges, isolated from any I/O so it is exhaustively testable.
// The runner in lib/billing/subscription-billing.ts executes these decisions;
// the billing callback owns the past_due/grace transition on failure.

export const DUNNING = {
  /** Total STK charge attempts before we stop retrying and rely on the grace window. */
  MAX_ATTEMPTS: 4,
  /** Minimum spacing between retry attempts. */
  RETRY_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24h
  /** How long a past_due subscription keeps working before soft-lock (suspend). */
  GRACE_PERIOD_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

export type DunningAction =
  | 'charge' // (re)send an STK prompt for this invoice
  | 'wait' // nothing to do this cycle (throttled, or awaiting a callback)
  | 'suspend' // grace elapsed with retries exhausted → soft-lock the subscription
  | 'none'; // already paid

export function decideDunningAction(
  invoice: { status: string; attemptCount: number; lastAttemptAt: Date | null },
  subscription: { gracePeriodEnd: Date | null },
  now: Date = new Date()
): DunningAction {
  if (invoice.status === 'paid') return 'none';
  // An STK is already in flight; the callback will resolve it — never double-charge.
  if (invoice.status === 'processing') return 'wait';

  // status is 'pending' or 'failed' from here.
  if (invoice.attemptCount === 0) return 'charge'; // never attempted → first charge

  // At least one attempt has failed.
  if (invoice.attemptCount >= DUNNING.MAX_ATTEMPTS) {
    const graceElapsed =
      subscription.gracePeriodEnd !== null && now.getTime() >= subscription.gracePeriodEnd.getTime();
    return graceElapsed ? 'suspend' : 'wait';
  }

  // Retries remain — throttle by the retry interval.
  const last = invoice.lastAttemptAt?.getTime() ?? 0;
  return now.getTime() - last >= DUNNING.RETRY_INTERVAL_MS ? 'charge' : 'wait';
}

/** Remaining retry attempts after the current attemptCount (for reminder copy). */
export function attemptsRemaining(attemptCount: number): number {
  return Math.max(0, DUNNING.MAX_ATTEMPTS - attemptCount);
}
