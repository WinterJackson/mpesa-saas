-- AlterTable
ALTER TABLE "WebhookDelivery" ADD COLUMN     "event" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'delivered';

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_createdAt_idx" ON "WebhookDelivery"("organizationId", "createdAt" DESC);
