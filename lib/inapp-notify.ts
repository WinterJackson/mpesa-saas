import { createNotification, type NotificationInput } from '@/lib/repositories/notifications';
import { isNotificationTypeEnabled } from '@/lib/repositories/notification-preferences';
import { logger } from '@/lib/logger';

/**
 * Fire-and-forget in-app notification write for the dashboard bell. NEVER throws
 * into the caller and never blocks — like the email notify* layer, an outage
 * here must not affect the money-movement path it's dispatched alongside. Call it
 * with `void recordNotification(...)` next to the matching email notification.
 *
 * Respects the org's notification preferences: a type whose category the org has
 * switched off is skipped. Unknown types and any preference-lookup failure fall
 * through to being recorded (fail-open) so nothing important is silently lost.
 */
export function recordNotification(input: NotificationInput): void {
  void (async () => {
    if (!(await isNotificationTypeEnabled(input.organizationId, input.type))) return;
    await createNotification(input);
  })().catch((err: unknown) => {
    logger.error('[inapp-notify] record failed', err instanceof Error ? err.message : 'unknown');
  });
}
