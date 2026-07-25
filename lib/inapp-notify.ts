import { createNotification, type NotificationInput } from '@/lib/repositories/notifications';
import { logger } from '@/lib/logger';

/**
 * Fire-and-forget in-app notification write for the dashboard bell. NEVER throws
 * into the caller and never blocks — like the email notify* layer, an outage
 * here must not affect the money-movement path it's dispatched alongside. Call it
 * with `void recordNotification(...)` next to the matching email notification.
 */
export function recordNotification(input: NotificationInput): void {
  void createNotification(input).catch((err: unknown) => {
    logger.error('[inapp-notify] record failed', err instanceof Error ? err.message : 'unknown');
  });
}
