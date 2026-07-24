import { describe, it, expect } from 'vitest';
import { decideDunningAction, attemptsRemaining, DUNNING } from './dunning';

const HOUR = 60 * 60 * 1000;

describe('decideDunningAction (pure dunning policy)', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');

  it('paid invoices need no action', () => {
    expect(decideDunningAction({ status: 'paid', attemptCount: 1, lastAttemptAt: null }, { gracePeriodEnd: null }, now)).toBe('none');
  });

  it('an in-flight (processing) invoice waits for its callback — never double-charges', () => {
    expect(decideDunningAction({ status: 'processing', attemptCount: 1, lastAttemptAt: now }, { gracePeriodEnd: null }, now)).toBe('wait');
  });

  it('a never-attempted invoice is charged immediately', () => {
    expect(decideDunningAction({ status: 'pending', attemptCount: 0, lastAttemptAt: null }, { gracePeriodEnd: null }, now)).toBe('charge');
  });

  it('a failed invoice is retried once the retry interval has elapsed', () => {
    const longAgo = new Date(now.getTime() - DUNNING.RETRY_INTERVAL_MS - HOUR);
    expect(decideDunningAction({ status: 'failed', attemptCount: 1, lastAttemptAt: longAgo }, { gracePeriodEnd: null }, now)).toBe('charge');
  });

  it('a recently-failed invoice waits (throttled) until the interval passes', () => {
    const recent = new Date(now.getTime() - HOUR);
    expect(decideDunningAction({ status: 'failed', attemptCount: 1, lastAttemptAt: recent }, { gracePeriodEnd: null }, now)).toBe('wait');
  });

  it('suspends once retries are exhausted AND the grace window has elapsed', () => {
    const graceElapsed = new Date(now.getTime() - HOUR);
    expect(
      decideDunningAction(
        { status: 'failed', attemptCount: DUNNING.MAX_ATTEMPTS, lastAttemptAt: graceElapsed },
        { gracePeriodEnd: graceElapsed },
        now
      )
    ).toBe('suspend');
  });

  it('does NOT suspend while still inside the grace window, even with retries exhausted', () => {
    const graceFuture = new Date(now.getTime() + 3 * 24 * HOUR);
    expect(
      decideDunningAction(
        { status: 'failed', attemptCount: DUNNING.MAX_ATTEMPTS, lastAttemptAt: new Date(now.getTime() - 2 * DUNNING.RETRY_INTERVAL_MS) },
        { gracePeriodEnd: graceFuture },
        now
      )
    ).toBe('wait');
  });

  it('attemptsRemaining never goes negative', () => {
    expect(attemptsRemaining(1)).toBe(DUNNING.MAX_ATTEMPTS - 1);
    expect(attemptsRemaining(DUNNING.MAX_ATTEMPTS + 5)).toBe(0);
  });
});
