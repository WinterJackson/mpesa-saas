import { prisma } from '@/lib/db';

/**
 * In-app notification feed (the dashboard bell). Org-scoped like every other
 * tenant repository (guardrail #6) — every function takes organizationId and
 * filters by it. Never stores secret material.
 */

export interface NotificationInput {
  organizationId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
}

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
    },
  });
}

export async function listNotifications(organizationId: string, opts: { take?: number } = {}) {
  return prisma.notification.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 20,
  });
}

export async function countUnreadNotifications(organizationId: string): Promise<number> {
  return prisma.notification.count({ where: { organizationId, read: false } });
}

/** Marks one notification read (org-scoped so a member can't touch another org's). */
export async function markNotificationRead(organizationId: string, id: string) {
  return prisma.notification.updateMany({ where: { id, organizationId }, data: { read: true } });
}

export async function markAllNotificationsRead(organizationId: string) {
  return prisma.notification.updateMany({ where: { organizationId, read: false }, data: { read: true } });
}
