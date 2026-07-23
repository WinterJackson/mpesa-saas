import { timingSafeEqual } from 'node:crypto';

/**
 * Authorizes an external cron request via an `Authorization: Bearer <token>`
 * header matched against CRON_SECRET in constant time.
 *
 * FAILS CLOSED: if CRON_SECRET is not configured, NO request is authorized.
 * These endpoints are public URLs (hit by cron-job.org in production), so an
 * unset secret must never mean "allow everyone" — it means "allow no one".
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET || '';
  if (!expected) return false; // fail closed — no secret, no access

  const provided = request.headers.get('authorization')?.split(' ')[1] || '';
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
