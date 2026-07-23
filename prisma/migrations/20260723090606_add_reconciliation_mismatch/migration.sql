-- CreateTable
CREATE TABLE "ReconciliationMismatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationMismatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationMismatch_status_detectedAt_idx" ON "ReconciliationMismatch"("status", "detectedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationMismatch_resourceType_resourceId_key" ON "ReconciliationMismatch"("resourceType", "resourceId");

