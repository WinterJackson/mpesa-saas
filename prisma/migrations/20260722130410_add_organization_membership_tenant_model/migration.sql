-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'read_write';

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL DEFAULT 'pending',
    "liveApprovedAt" TIMESTAMP(3),
    "liveApprovedBy" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_clerkOrgId_key" ON "Organization"("clerkOrgId");

-- CreateIndex
CREATE INDEX "Membership_clerkUserId_idx" ON "Membership"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_clerkUserId_key" ON "Membership"("organizationId", "clerkUserId");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_organizationId_key" ON "Merchant"("organizationId");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_createdAt_idx" ON "Transaction"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_organizationId_status_idx" ON "Transaction"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

